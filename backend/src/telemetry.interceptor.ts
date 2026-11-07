import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { context as otelContext, metrics, trace } from "@opentelemetry/api";
import type { Request } from "express";
import { catchError, finalize, tap, throwError } from "rxjs";

const meter = metrics.getMeter("shopping-api");
const requestCounter = meter.createCounter("http.server.requests");
const durationHistogram = meter.createHistogram("http.server.duration", {
  unit: "s",
});
const tracer = trace.getTracer("shopping-api");

@Injectable()
export class TelemetryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<Request>();
    const route = request.route?.path
      ? `${request.baseUrl}${request.route.path}`
      : "unmatched";
    const span = tracer.startSpan(`${request.method} ${route}`);
    const startedAt = performance.now();
    let statusCode = 200;
    span.setAttribute("http.request.method", request.method);
    span.setAttribute("http.route", route);

    return otelContext.with(trace.setSpan(otelContext.active(), span), () =>
      next.handle().pipe(
        tap(() => span.setAttribute("http.response.status_code", statusCode)),
        catchError((error: unknown) => {
          statusCode =
            typeof error === "object" &&
            error !== null &&
            "getStatus" in error &&
            typeof error.getStatus === "function"
              ? Number(error.getStatus())
              : 500;
          span.setAttribute("http.response.status_code", statusCode);
          span.setAttribute("error", true);
          if (error instanceof Error) span.recordException(error);
          return throwError(() => error);
        }),
        finalize(() => {
          const durationMs = performance.now() - startedAt;
          const attributes = {
            "http.request.method": request.method,
            "http.route": route,
            "http.response.status_code": statusCode,
          };
          requestCounter.add(1, attributes);
          durationHistogram.record(durationMs / 1_000, attributes);
          span.end();
        }),
      ),
    );
  }
}

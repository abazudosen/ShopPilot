import "./telemetry";
import { ValidationPipe } from "@nestjs/common";
import { HttpAdapterHost, NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import * as Sentry from "@sentry/nestjs";
import { SentryGlobalFilter } from "@sentry/nestjs/setup";
import { AppModule } from "./app.module";

const sentryDsn = process.env.SENTRY_DSN?.trim();
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? "development",
    tracesSampleRate: 0,
    beforeSend(event) {
      delete event.user;
      if (event.request) {
        delete event.request.data;
        delete event.request.query_string;
        if (event.request.url) {
          try {
            const url = new URL(event.request.url);
            url.search = "";
            url.hash = "";
            event.request.url = url.toString();
          } catch {
            event.request.url = event.request.url.split(/[?#]/, 1)[0];
          }
        }
        if (event.request.headers) {
          for (const header of Object.keys(event.request.headers)) {
            if (/authorization|cookie|token|password/i.test(header)) {
              event.request.headers[header] = "[Filtered]";
            }
          }
        }
      }
      return event;
    },
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  if (sentryDsn) {
    const { httpAdapter } = app.get(HttpAdapterHost);
    app.useGlobalFilters(new SentryGlobalFilter(httpAdapter));
  }
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({ origin: "http://localhost:5173" });

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("ShopPilot API")
      .setDescription("Version 1 of the ShopPilot API")
      .setVersion("1.0.0")
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup("docs/v1", app, document, {
    jsonDocumentUrl: "docs/v1/openapi.json",
  });

  await app.listen(process.env.PORT ?? 3500);
}
bootstrap();

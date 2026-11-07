import { NodeSDK } from "@opentelemetry/sdk-node";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

const metricPort = Number(process.env.METRICS_PORT ?? 9464);
if (!Number.isInteger(metricPort) || metricPort < 1 || metricPort > 65_535) {
  throw new Error("METRICS_PORT must be a valid TCP port");
}

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/+$/, "");
const sdk = new NodeSDK({
  metricReaders: [
    new PrometheusExporter({
      port: metricPort,
      host: process.env.METRICS_HOST ?? "0.0.0.0",
    }),
  ],
  ...(endpoint
    ? {
        traceExporter: new OTLPTraceExporter({
          url: `${endpoint}/v1/traces`,
        }),
      }
    : {}),
});

void sdk.start();

process.once("SIGTERM", () => {
  void sdk.shutdown();
});
process.once("SIGINT", () => {
  void sdk.shutdown();
});

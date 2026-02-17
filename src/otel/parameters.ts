export const configuration = {
  // general
  serviceName: process.env.OTEL_SERVICE_NAME || 'unknown service name',
  serviceVersion: process.env.OTEL_SERVICE_VERSION || 'unknown service version',
  // tracing
  tracesExporter: process.env.OTEL_TRACES_EXPORTER || 'console',
  tracesSampler: process.env.OTEL_TRACES_SAMPLER || 'always',
  // logging
  logsExporter: process.env.OTEL_LOGS_EXPORTER || 'console',
  // metrics
};

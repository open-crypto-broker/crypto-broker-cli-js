// Load .env file when running the CLI binary directly (outside of the task runner).
// process.loadEnvFile() does not override variables that are already set.
try {
  process.loadEnvFile();
} catch {
  // .env file not found or Node.js version does not support loadEnvFile — ignore
}

export const configuration = {
  // general
  serviceName: process.env.OTEL_SERVICE_NAME || 'unknown service name',
  serviceVersion: process.env.OTEL_SERVICE_VERSION || 'unknown service version',
  serviceNamespace: 'crypto-broker',
  // tracing
  tracesExporter: process.env.OTEL_TRACES_EXPORTER || 'console',
  tracesSampler: process.env.OTEL_TRACES_SAMPLER || 'always',
  // logging
  logsExporter: process.env.OTEL_LOGS_EXPORTER || 'console',
  // metrics
};

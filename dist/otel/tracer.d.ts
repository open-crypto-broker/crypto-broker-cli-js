import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
declare let tracingProvider: NodeTracerProvider;
declare const tracer: import("@opentelemetry/api").Tracer;
export { tracer, tracingProvider };

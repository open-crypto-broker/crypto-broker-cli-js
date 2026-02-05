import {
  AlwaysOnSampler,
  AlwaysOffSampler,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
  NodeTracerProvider,
  SpanProcessor,
  BatchSpanProcessor,
  ConsoleSpanExporter,
} from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter as GrpcExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPTraceExporter as HttpExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPTraceExporter as ProtoExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import {
  resourceFromAttributes,
  detectResources,
  processDetector,
} from '@opentelemetry/resources';
import { trace } from '@opentelemetry/api';

const configuration = {
  serviceName: process.env.OTEL_SERVICE_NAME || 'unknown service name',
  serviceVersion: process.env.OTEL_SERVICE_VERSION || 'unknown service version',
  tracesExporter: process.env.OTEL_TRACES_EXPORTER || 'console',
  sampler: process.env.OTEL_TRACES_SAMPLER || 'always',
};

const buildExporter = (name: string) => {
  const collectorOptions = {
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  };
  switch (name) {
    default:
      console.warn(`"${name}" is not a valid exporter value. Skipping...`);
      return undefined;
    case 'console':
      console.log('Registered console exporter.');
      return new ConsoleSpanExporter();
    case 'otlpgrpc':
      console.log('Registered grpc exporter.');
      return new GrpcExporter(collectorOptions);
    case 'otlphttp':
      if (process.env.OTEL_EXPORTER_OTLP_HEADERS_AUTHORIZATION !== '') {
        collectorOptions['headers'] = {
          Authorization: process.env.OTEL_EXPORTER_OTLP_HEADERS_AUTHORIZATION,
        };
      }
      console.log('Registered http exporter.');
      return new HttpExporter(collectorOptions);
    case 'otlpproto':
      if (process.env.OTEL_EXPORTER_OTLP_HEADERS_AUTHORIZATION !== '') {
        collectorOptions['headers'] = {
          Authorization: process.env.OTEL_EXPORTER_OTLP_HEADERS_AUTHORIZATION,
        };
      }
      console.log('Registered protobuf exporter.');
      return new ProtoExporter(collectorOptions);
  }
};

const buildSampler = (name: string) => {
  switch (name) {
    default:
      console.warn('Unknown OTEL_TRACES_SAMPLER value, using always_on.');
    // eslint-disable-next-line no-fallthrough
    case 'always':
    case 'always_on':
      console.log('always_on sampler configured.');
      return new AlwaysOnSampler();
    case 'never':
    case 'always_off':
      console.log('always_off sampler configured.');
      return new AlwaysOffSampler();
    case 'traceidratio':
    case 'ratio': {
      console.log('traceidratio sampler configured.');
      const ratio = parseFloat(process.env.OTEL_TRACES_SAMPLER_ARG ?? '1.0');
      return new TraceIdRatioBasedSampler(ratio);
    }
    case 'parentbased_always_on':
      console.log('parentbased_always_on sampler configured.');
      return new ParentBasedSampler({ root: new AlwaysOnSampler() });
    case 'parentbased_always_off':
      console.log('parentbased_always_off sampler configured.');
      return new ParentBasedSampler({ root: new AlwaysOffSampler() });
    case 'parentbased_traceidratio': {
      console.log('parentbased_traceidratio sampler configured.');
      const pb_ratio = parseFloat(process.env.OTEL_TRACES_SAMPLER_ARG ?? '1.0');
      return new ParentBasedSampler({
        root: new TraceIdRatioBasedSampler(pb_ratio),
      });
    }
  }
};

// configure span processor with exporters
const spanProcessors: SpanProcessor[] = [];
configuration.tracesExporter.split(',').forEach((traceExporter: string) => {
  const exporter = buildExporter(traceExporter.trim());
  // check and continue if exporter is invalid
  if (!exporter) return;
  spanProcessors.push(new BatchSpanProcessor(exporter));
});

let tracingProvider: NodeTracerProvider;
if (spanProcessors.length > 0) {
  // configure the provider
  tracingProvider = new NodeTracerProvider({
    spanProcessors: spanProcessors,
    resource: detectResources({
      detectors: [processDetector],
    }).merge(
      resourceFromAttributes({
        [ATTR_SERVICE_NAME]: configuration.serviceName,
        [ATTR_SERVICE_VERSION]: configuration.serviceVersion,
      }),
    ),
    sampler: buildSampler(configuration.sampler),
  });
} else {
  console.warn('No valid exporter was provided. Using default provider.');
  tracingProvider = new NodeTracerProvider();
}

tracingProvider.register();
const tracer = trace.getTracer(configuration.serviceName);
export { tracer, tracingProvider };

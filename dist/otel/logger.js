import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston';
import { resourceFromAttributes, detectResources, processDetector, } from '@opentelemetry/resources';
import { logs } from '@opentelemetry/api-logs';
import { LoggerProvider, BatchLogRecordProcessor, ConsoleLogRecordExporter, } from '@opentelemetry/sdk-logs';
import { OTLPLogExporter as GrpcExporter } from '@opentelemetry/exporter-logs-otlp-grpc';
import { OTLPLogExporter as HttpExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPLogExporter as ProtoExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION, } from '@opentelemetry/semantic-conventions';
import { configuration } from './parameters.js';
const buildExporter = (name) => {
    const collectorOptions = {
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    };
    switch (name) {
        default:
            console.warn(`"${name}" is not a valid log exporter value. Skipping...`);
        // eslint-disable-next-line no-fallthrough
        case 'none':
            console.log('Using no log exporter.');
            return undefined;
        case 'console':
            console.log('Registered console log exporter.');
            return new ConsoleLogRecordExporter();
        case 'otlpgrpc':
            console.log('Registered grpc log exporter.');
            return new GrpcExporter(collectorOptions);
        case 'otlphttp':
            if (process.env.OTEL_EXPORTER_OTLP_HEADERS_AUTHORIZATION !== '') {
                collectorOptions['headers'] = {
                    Authorization: process.env.OTEL_EXPORTER_OTLP_HEADERS_AUTHORIZATION,
                };
            }
            collectorOptions.url += '/v1/logs';
            console.log('Registered http log exporter.');
            return new HttpExporter(collectorOptions);
        case 'otlpproto':
            if (process.env.OTEL_EXPORTER_OTLP_HEADERS_AUTHORIZATION !== '') {
                collectorOptions['headers'] = {
                    Authorization: process.env.OTEL_EXPORTER_OTLP_HEADERS_AUTHORIZATION,
                };
            }
            console.log('Registered protobuf log exporter.');
            return new ProtoExporter(collectorOptions);
    }
};
// configure span processor with exporters
const logProcessors = [];
configuration.logsExporter.split(',').forEach((logsExporter) => {
    const exporter = buildExporter(logsExporter.trim());
    // check and continue if exporter is invalid
    if (!exporter)
        return;
    logProcessors.push(new BatchLogRecordProcessor(exporter));
});
const loggingProvider = new LoggerProvider({
    processors: logProcessors,
    resource: detectResources({
        detectors: [processDetector],
    }).merge(resourceFromAttributes({
        [ATTR_SERVICE_NAME]: configuration.serviceName,
        [ATTR_SERVICE_VERSION]: configuration.serviceVersion,
    })),
});
logs.setGlobalLoggerProvider(loggingProvider);
registerInstrumentations({
    instrumentations: [new WinstonInstrumentation()],
});
export { loggingProvider };
//# sourceMappingURL=logger.js.map
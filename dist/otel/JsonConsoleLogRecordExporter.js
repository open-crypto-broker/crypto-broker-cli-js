import { ExportResultCode, hrTimeToMicroseconds } from '@opentelemetry/core';
export class JsonConsoleLogRecordExporter {
    export(records, resultCallback) {
        for (const record of records) {
            console.log(JSON.stringify({
                resource: { attributes: record.resource.attributes },
                instrumentationScope: record.instrumentationScope,
                timestamp: hrTimeToMicroseconds(record.hrTime),
                traceId: record.spanContext?.traceId,
                spanId: record.spanContext?.spanId,
                traceFlags: record.spanContext?.traceFlags,
                severityText: record.severityText,
                severityNumber: record.severityNumber,
                eventName: record.eventName,
                body: record.body,
                attributes: record.attributes,
            }, null, 2));
        }
        resultCallback({ code: ExportResultCode.SUCCESS });
    }
    forceFlush() {
        return Promise.resolve();
    }
    shutdown() {
        return Promise.resolve();
    }
}
//# sourceMappingURL=JsonConsoleLogRecordExporter.js.map
import { ExportResultCode, hrTimeToMicroseconds } from '@opentelemetry/core';
export class JsonConsoleSpanExporter {
    /**
     * Export spans.
     * @param spans
     * @param resultCallback
     */
    export(spans, resultCallback) {
        return this._sendSpans(spans, resultCallback);
    }
    /**
     * Shutdown the exporter.
     */
    shutdown() {
        this._sendSpans([]);
        return this.forceFlush();
    }
    /**
     * Exports any pending spans in exporter
     */
    forceFlush() {
        return Promise.resolve();
    }
    /**
     * converts span info into more readable format
     * @param span
     */
    _exportInfo(span) {
        return {
            resource: {
                attributes: span.resource.attributes,
            },
            instrumentationScope: span.instrumentationScope,
            traceId: span.spanContext().traceId,
            parentSpanContext: span.parentSpanContext,
            traceState: span.spanContext().traceState?.serialize(),
            name: span.name,
            id: span.spanContext().spanId,
            kind: span.kind,
            timestamp: hrTimeToMicroseconds(span.startTime),
            duration: hrTimeToMicroseconds(span.duration),
            attributes: span.attributes,
            status: span.status,
            events: span.events,
            links: span.links,
        };
    }
    /**
     * Showing spans in console
     * @param spans
     * @param done
     */
    _sendSpans(spans, done) {
        for (const span of spans) {
            console.log(JSON.stringify(this._exportInfo(span), null, 2));
        }
        if (done) {
            return done({ code: ExportResultCode.SUCCESS });
        }
    }
}
//# sourceMappingURL=JsonConsoleSpanExporter.js.map
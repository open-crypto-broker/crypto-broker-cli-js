import type { ExportResult } from '@opentelemetry/core';
import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-node';
export declare class JsonConsoleSpanExporter implements SpanExporter {
    /**
     * Export spans.
     * @param spans
     * @param resultCallback
     */
    export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void;
    /**
     * Shutdown the exporter.
     */
    shutdown(): Promise<void>;
    /**
     * Exports any pending spans in exporter
     */
    forceFlush(): Promise<void>;
    /**
     * converts span info into more readable format
     * @param span
     */
    private _exportInfo;
    /**
     * Showing spans in console
     * @param spans
     * @param done
     */
    private _sendSpans;
}

/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Origin: experimental/packages/sdk-logs/src/export/ConsoleLogRecordExporter.ts
 * Modification uses JSON stringify instead of console.dir.
 */
import type { ExportResult } from '@opentelemetry/core';
import { ExportResultCode, hrTimeToMicroseconds } from '@opentelemetry/core';
import type {
  LogRecordExporter,
  ReadableLogRecord,
} from '@opentelemetry/sdk-logs';

export class JsonConsoleLogRecordExporter implements LogRecordExporter {
  export(
    records: ReadableLogRecord[],
    resultCallback: (result: ExportResult) => void,
  ): void {
    for (const record of records) {
      console.log(
        JSON.stringify(
          {
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
          },
          null,
          2,
        ),
      );
    }
    resultCallback({ code: ExportResultCode.SUCCESS });
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

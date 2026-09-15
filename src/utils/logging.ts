import { createLogger, transports } from 'winston';

export const logger = createLogger({
  transports: [new transports.Console()],
});

// For benchmarking
interface LogEntry {
  operation: string;
  duration: bigint;
}
export class DurationLogs {
  private entries: LogEntry[];

  constructor() {
    this.entries = [];
  }
  add(operation: string, duration: bigint) {
    this.entries.push({ operation: operation, duration: duration });
  }
  get(operation?: string): LogEntry[] {
    return this.entries.filter(
      (entry) => operation === undefined || entry.operation === operation,
    );
  }
  sum(operation?: string): bigint {
    let sum: bigint = 0n;
    const filtered = this.entries.filter(
      (entry) => operation === undefined || entry.operation === operation,
    );
    for (const entry of filtered) {
      sum += entry.duration;
    }
    return sum;
  }
  avg(operation?: string): bigint {
    const filtered = this.entries.filter(
      (entry) => operation === undefined || entry.operation === operation,
    );
    if (filtered.length == 0) {
      return BigInt(-1);
    }
    return this.sum(operation) / BigInt(filtered.length);
  }
  summarizeAvg(
    operations: string[],
    title: string = 'Average Duration Summary',
  ) {
    let summary = title + '\n';
    for (const operation of operations) {
      summary += `- ${operation}: ${this.avg(operation)} µs\n`;
    }
    return summary;
  }
  logDuration(label: string, start: bigint, end: bigint) {
    const durationMicroS = (end - start) / BigInt(1000.0);
    logger.info(`${label} took ${durationMicroS} µs`);
    this.add(label, durationMicroS);
  }
}

/*export function logDuration(label: string, start: bigint, end: bigint) {
  const durationMicroS = (end - start) / BigInt(1000.0);
  logger.info(`${label} took ${durationMicroS} µs`);
  if (typeof durationLogs === 'object') {
    durationLogs.add(label, durationMicroS);
  }
}*/

export declare const logger: import("winston").Logger;
interface LogEntry {
    operation: string;
    duration: bigint;
}
export declare class DurationLogs {
    private entries;
    constructor();
    add(operation: string, duration: bigint): void;
    get(operation?: string): LogEntry[];
    sum(operation?: string): bigint;
    avg(operation?: string): bigint;
    summarizeAvg(operations: string[], title?: string): string;
    logDuration(label: string, start: bigint, end: bigint): void;
}
export {};

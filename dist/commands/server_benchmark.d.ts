import { Namespace, SubparsersAction } from 'argparse';
import { Command } from './command.js';
import { AttrCorrelationId, AttrCryptoBenchmarkResultsSize, AttrRpcMethod } from '../otel/attributes.js';
export declare function addBenchmarkParser(sub_parsers: SubparsersAction): void;
export declare class BenchmarkCommand implements Command {
    readonly methodName = "Benchmark";
    profile: string;
    constructor(parsed_args: Namespace);
    getPayload(): {};
    getRequestAttributes(): {
        [AttrRpcMethod]: string;
    };
    getResponseAttributes(response: any): {
        [AttrCorrelationId]: any;
        [AttrCryptoBenchmarkResultsSize]: any;
    };
}

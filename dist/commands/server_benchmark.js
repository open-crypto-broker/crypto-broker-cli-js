import { AttrCorrelationId, AttrCryptoBenchmarkResultsSize, AttrRpcMethod, } from '../otel/attributes.js';
export function addBenchmarkParser(sub_parsers) {
    sub_parsers.add_parser('benchmark', {
        help: 'request server-side benchmark',
    });
}
export class BenchmarkCommand {
    methodName = 'Benchmark';
    profile;
    constructor(parsed_args) {
        this.profile = parsed_args.profile;
    }
    getPayload() {
        return {};
    }
    getRequestAttributes() {
        return {
            [AttrRpcMethod]: this.methodName,
        };
    }
    getResponseAttributes(response) {
        return {
            [AttrCorrelationId]: response.metadata?.traceContext?.correlationId,
            [AttrCryptoBenchmarkResultsSize]: response.benchmarkResults.length,
        };
    }
}
//# sourceMappingURL=server_benchmark.js.map
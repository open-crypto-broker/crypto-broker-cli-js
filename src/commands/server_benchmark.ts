import { Namespace, SubparsersAction } from 'argparse';
import { Command } from './command.js';
import {
  AttrCorrelationId,
  AttrCryptoBenchmarkResultsSize,
  AttrRpcMethod,
} from '../otel/attributes.js';

export function addBenchmarkParser(sub_parsers: SubparsersAction) {
  sub_parsers.add_parser('benchmark', {
    help: 'request server-side benchmark',
  });
}

export class BenchmarkCommand implements Command {
  readonly methodName = 'Benchmark';
  profile: string;

  constructor(parsed_args: Namespace) {
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

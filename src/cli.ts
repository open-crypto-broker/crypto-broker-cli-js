#!/usr/bin/env node
import 'reflect-metadata';
import { tracer, tracingProvider } from './otel/tracer.js';
import { loggingProvider } from './otel/logger.js';
import { context, SpanStatusCode, trace } from '@opentelemetry/api';
import {
  BenchmarkPayload,
  CryptoBrokerClient,
  HashDataPayload,
  HashDataOutputFormat,
  SignCertificateOutputFormat,
  SignCertificatePayload,
  GIT_HASH as CLIENT_HASH,
  VERSION as CLIENT_VERSION,
} from '@open-crypto-broker/cryptobroker-client';
import {
  AttrCorrelationId,
  AttrCryptoBenchmarkResultsSize,
  AttrCryptoCaCertSize,
  AttrCryptoCaKeySize,
  AttrCryptoCsrSize,
  AttrCryptoHashAlgorithm,
  AttrCryptoHashOutputSize,
  AttrCryptoInputSize,
  AttrCryptoProfile,
  AttrCryptoSignCertificateSize,
  AttrRpcMethod,
} from './otel/attributes.js';

import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { Bench } from 'tinybench';
import {
  ArgumentDefaultsHelpFormatter,
  ArgumentParser,
  ArgumentTypeError,
} from 'argparse';
import { createLogger, transports } from 'winston';

const logger = createLogger({
  transports: [new transports.Console()],
});

enum ServingStatus {
  UNKNOWN = 0,
  SERVING = 1,
  NOT_SERVING = 2,
  /** SERVICE_UNKNOWN - Used only by the Watch method. */
  SERVICE_UNKNOWN = 3,
  UNRECOGNIZED = -1,
}

// For benchmarking
interface LogEntry {
  operation: string;
  duration: bigint;
}
class DurationLogs {
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
}
let durationLogs: DurationLogs;

function hasErrorCode(code: (string | number)[], err: unknown): err is Error {
  return typeof err === 'object' && err !== null && code.includes(err['code']);
}

function logDuration(label: string, start: bigint, end: bigint) {
  const durationMicroS = (end - start) / BigInt(1000.0);
  logger.info(`${label} took ${durationMicroS} µs`);
  if (typeof durationLogs === 'object') {
    durationLogs.add(label, durationMicroS);
  }
}

function numToHexString(n: number): string {
  return n.toString(16).padStart(2, '0');
}

function enumKeysToStringArray<E extends Record<string, string | number>>(
  enumType: E,
) {
  return Object.keys(enumType)
    .filter((key) => isNaN(Number(key)))
    .filter((key) => key !== 'UNRECOGNIZED'); // do not use -1
}

function init_parser() {
  const parser = new ArgumentParser({
    formatter_class: ArgumentDefaultsHelpFormatter,
  });
  const sub_parsers = parser.add_subparsers({
    help: 'Command Selection',
    dest: 'command',
  });

  // main parser arguments
  parser.add_argument('--loop', {
    help: 'Loops the request with the specified delay (in ms).',
    dest: 'delay',
    type: (arg: string) => {
      const int_arg = parseInt(arg);
      if (int_arg <= 0 || int_arg > 1000) {
        throw new ArgumentTypeError(
          'The delay value must be between 1ms and 1000ms.',
        );
      }
      return int_arg;
    },
  });
  sub_parsers.add_parser('version', {
    help: 'Shows version numbers of client library and CLI.',
  });

  // hash data sub-parser and arguments
  const hash_data_parser = sub_parsers.add_parser('hash-data', {
    help: 'Creates a hash',
  });
  hash_data_parser.add_argument('--profile', {
    help: 'Profile Selection',
    default: 'Default',
  });
  hash_data_parser.add_argument('--output-format', {
    default: 'HEX',
    choices: enumKeysToStringArray(HashDataOutputFormat),
    type: (str: string) => str.toUpperCase(),
    help: 'Specifies which encoding should be used for the hashing operation',
  });
  hash_data_parser.add_argument('data');

  // sign certificate sub-parser and arguments
  const sign_certificate_parser = sub_parsers.add_parser('sign-certificate', {
    help: 'Signs a CSR',
  });
  sign_certificate_parser.add_argument('--profile', {
    help: 'Profile Selection',
    default: 'Default',
  });
  sign_certificate_parser.add_argument('--encoding', {
    default: 'PEM',
    choices: enumKeysToStringArray(SignCertificateOutputFormat),
    type: (str: string) => str.toUpperCase(),
    help: 'Specifies which encoding should be used for the signing operation',
  });
  sign_certificate_parser.add_argument('--subject', {
    help: 'Subject for the signing request (will overwrite the subject in the CSR)',
  });
  sign_certificate_parser.add_argument('--csr', {
    help: 'Path to CSR file',
    required: true,
  });
  sign_certificate_parser.add_argument('--caCert', {
    help: 'Path to CA certificate file',
    required: true,
  });
  sign_certificate_parser.add_argument('--caKey', {
    help: 'Path to CA private key file',
    required: true,
  });

  sub_parsers.add_parser('health', {
    help: 'request server health status',
  });

  sub_parsers.add_parser('benchmark', {
    help: 'request server-side benchmark',
  });

  const benchmark_parser = sub_parsers.add_parser('local-benchmark', {
    help: 'runs the local benchmark',
  });
  benchmark_parser.add_argument('--hashData-data', {
    help: 'String to be hashed',
    required: true,
  });
  benchmark_parser.add_argument('--signCertificate-csr', {
    help: 'Path to CSR file',
    required: true,
  });
  benchmark_parser.add_argument('--signCertificate-caCert', {
    help: 'Path to CA certificate file',
    required: true,
  });
  benchmark_parser.add_argument('--signCertificate-caKey', {
    help: 'Path to CA private key file',
    required: true,
  });

  return parser.parse_args();
}

async function execute(cryptoLib: CryptoBrokerClient, parsed_args) {
  const command: string = parsed_args.command;
  const profile: string = parsed_args.profile;

  // Data hashing
  // Usage: cli.js [--loop <delay>] hash-data [--profile <profile>] <data>
  if (command === 'hash-data') {
    const data: string = parsed_args.data;
    const format: string = parsed_args.output_format;
    const span = tracer.startSpan('CLI.HashData', {
      attributes: {
        [AttrRpcMethod]: 'HashData',
        [AttrCryptoProfile]: profile,
        [AttrCryptoInputSize]: data.length,
      },
    });

    logger.info(`Hashing using '${profile}' profile...`);
    const start = process.hrtime.bigint();
    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        // prepare payload
        const payload: HashDataPayload = {
          profile: profile,
          input: Buffer.from(data),
          metadata: {
            id: randomUUID(),
            traceContext: {
              traceId: span.spanContext().traceId,
              spanId: span.spanContext().spanId,
              traceFlags: numToHexString(span.spanContext().traceFlags),
              traceState: span.spanContext().traceState?.serialize() || '',
              correlationId: randomUUID(),
            },
          },
          outputFormat:
            HashDataOutputFormat[format] ?? HashDataOutputFormat.HEX,
        };

        // hash request
        const hashResponse = await cryptoLib.hashData(payload);

        // set additional tracing attributes
        span.setAttributes({
          [AttrCorrelationId]:
            hashResponse.metadata?.traceContext?.correlationId,
          [AttrCryptoHashAlgorithm]: hashResponse.hashAlgorithm,
          [AttrCryptoHashOutputSize]:
            hashResponse.hashValueHex?.length ??
            hashResponse.hashValueRaw?.length ??
            0,
        });

        console.log(JSON.stringify(hashResponse));
        span.setStatus({
          code: SpanStatusCode.OK,
          message: 'Data Hashing successful.',
        });
      } catch (err) {
        if (err instanceof Error) {
          span.recordException(err);
          span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        }
        throw err;
      } finally {
        const end = process.hrtime.bigint();
        logDuration('Data Hashing', start, end);
        span.end();
      }
    });
    // Certificate signing
    // Usage: cli.js [--loop <delay>] sign-certificate [--profile <profile>] [--encoding={DER,PEM}] [--subject <subject>] --csr <path-to-csr> --caCert <path-to-caCert> --caKey <path-to-caKey>
  } else if (command === 'sign-certificate') {
    const csrPath = parsed_args.csr;
    const caCertPath = parsed_args.caCert;
    const signingKeyPath = parsed_args.caKey;
    const encoding: string = parsed_args.encoding;
    const subject: string = parsed_args.subject;

    const span = tracer.startSpan('CLI.SignCertificate', {
      attributes: {
        [AttrRpcMethod]: 'SignCertificate',
        [AttrCryptoProfile]: profile,
      },
    });

    logger.info(`Signing certificate using '${profile}' profile...`);
    const start = process.hrtime.bigint();
    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        // prepare payload
        const csr = fs.readFileSync(csrPath, 'utf8');
        const caCert = fs.readFileSync(caCertPath, 'utf8');
        const caPrivateKey = fs.readFileSync(signingKeyPath, 'utf8');

        // add tracing attributes
        span.setAttributes({
          [AttrCryptoCsrSize]: csr.length,
          [AttrCryptoCaCertSize]: caCert.length,
          [AttrCryptoCaKeySize]: caPrivateKey.length,
        });

        const payload: SignCertificatePayload = {
          profile: profile,
          csr: csr,
          caPrivateKey: caPrivateKey,
          caCert: caCert,
          metadata: {
            id: randomUUID(),
            traceContext: {
              traceId: span.spanContext().traceId,
              spanId: span.spanContext().spanId,
              traceFlags: numToHexString(span.spanContext().traceFlags),
              traceState: span.spanContext().traceState?.serialize() || '',
              correlationId: randomUUID(),
            },
          },
          crlDistributionPoints: [
            'http://example.com/crls/list1.crl',
            'http://example.com/crls/list2.crl',
          ],
          outputFormat:
            SignCertificateOutputFormat[encoding] ??
            SignCertificateOutputFormat.PEM,
        };

        // add subject to payload if it was provided
        if (subject) {
          payload['subject'] = subject;
          logger.info(`Note: The CSR subject will be overwritten by argument.`);
        }
        // sign certificate request
        const signCertificateResponse =
          await cryptoLib.signCertificate(payload);
        console.log(JSON.stringify(signCertificateResponse));

        // set additional tracing attribute
        span.setAttributes({
          [AttrCorrelationId]:
            signCertificateResponse.metadata?.traceContext?.correlationId,
          [AttrCryptoSignCertificateSize]:
            signCertificateResponse.pem?.length ??
            signCertificateResponse.der?.length ??
            0,
        });
        span.setStatus({
          code: SpanStatusCode.OK,
          message: 'Certificate Signing successful',
        });
      } catch (err) {
        if (err instanceof Error) {
          span.recordException(err);
          span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        }
        throw err;
      } finally {
        const end = process.hrtime.bigint();
        logDuration('Certificate Signing', start, end);
        span.end();
      }
    });
    // Health Status
    // Usage: cli.js [--loop <delay>] health
  } else if (command === 'health') {
    const span = tracer.startSpan('CLI.Health', {
      attributes: {
        [AttrRpcMethod]: 'Health',
      },
    });

    logger.info('Requesting server health status...');
    const start = process.hrtime.bigint();
    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        const healthResponse = await cryptoLib.healthData();
        const prettyData = {
          ...healthResponse,
          status: ServingStatus[healthResponse.status],
        };
        console.log(JSON.stringify(prettyData));

        span.setStatus({
          code: SpanStatusCode.OK,
          message: 'Health Request successful.',
        });
      } catch (err) {
        if (err instanceof Error) {
          span.recordException(err);
          span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        }
        throw err;
      } finally {
        const end = process.hrtime.bigint();
        logDuration('Health Status', start, end);
        span.end();
      }
    });
    // Server-side benchmark (self-test)
    // Usage: cli.js benchmark
  } else if (command === 'benchmark') {
    const span = tracer.startSpan('CLI.Benchmark', {
      attributes: {
        [AttrRpcMethod]: 'Benchmark',
      },
    });

    logger.info('Running server-side benchmarks...');
    const start = process.hrtime.bigint();
    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        // prepare payload
        const payload: BenchmarkPayload = {
          metadata: {
            id: randomUUID(),
            traceContext: {
              traceId: span.spanContext().traceId,
              spanId: span.spanContext().spanId,
              traceFlags: numToHexString(span.spanContext().traceFlags),
              traceState: span.spanContext().traceState?.serialize() || '',
              correlationId: randomUUID(),
            },
          },
        };

        // benchmark request
        const benchmarkResponse = await cryptoLib.benchmarkData(payload);
        const prettyResponse = {
          benchmarkResults: JSON.parse(benchmarkResponse.benchmarkResults),
        };
        console.log(JSON.stringify(prettyResponse));

        // set additional tracing attribute
        span.setAttributes({
          [AttrCorrelationId]:
            benchmarkResponse.metadata?.traceContext?.correlationId,
          [AttrCryptoBenchmarkResultsSize]:
            benchmarkResponse.benchmarkResults.length,
        });
        span.setStatus({
          code: SpanStatusCode.OK,
          message: 'Benchmark Request successful.',
        });
      } catch (err) {
        if (err instanceof Error) {
          span.recordException(err);
          span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        }
        throw err;
      } finally {
        const end = process.hrtime.bigint();
        logDuration('Health Status', start, end);
        span.end();
      }
    });
  }
}

async function main() {
  // signal handling
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, exiting...');
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, exiting...');
    process.exit(0);
  });

  // initializes the parsers
  const parsed_args = init_parser();

  if (parsed_args.command === 'version') {
    const CLI_VERSION =
      typeof __VERSION__ === 'undefined'
        ? '<unbundled-dev-version>'
        : __VERSION__;
    const CLI_HASH =
      typeof __GIT_HASH__ === 'undefined'
        ? '<unbundled-git-hash>'
        : __GIT_HASH__;

    const versions = {
      client: {
        version: `${CLIENT_VERSION}`,
        git_sha: `${CLIENT_HASH}`,
      },
      cli: {
        version: `${CLI_VERSION}`,
        git_sha: `${CLI_HASH}`,
      },
    };
    console.log(JSON.stringify(versions, null, 2));
    process.exit(0);
  }

  try {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    if (parsed_args.command === 'local-benchmark') {
      const cryptoLib = await CryptoBrokerClient.NewLibrary({
        circuitBreakerOptions: { enabled: false },
      });

      const bench = new Bench({
        name: 'Local CLI-JS Benchmark',
        iterations: 100,
      });
      durationLogs = new DurationLogs();

      bench
        .add('hashData', async () => {
          const args = {
            command: 'hash-data',
            profile: 'Default',
            output_format: 'HEX',
            data: parsed_args.hashData_data,
          };
          await execute(cryptoLib, args);
        })
        .add('signCertificate', async () => {
          const args = {
            command: 'sign-certificate',
            profile: 'Default',
            csr: parsed_args.signCertificate_csr,
            caCert: parsed_args.signCertificate_caCert,
            caKey: parsed_args.signCertificate_caKey,
            encoding: 'PEM',
          };
          await execute(cryptoLib, args);
        })
        .add('health', async () => {
          const args = {
            command: 'health',
          };
          await execute(cryptoLib, args);
        });

      await bench.run();
      console.log('Benchmark Summary:');
      console.table(bench.table());
      console.log(
        durationLogs.summarizeAvg(
          ['Data Hashing', 'Certificate Signing', 'Health Status'],
          'Average gRPC response overhead:',
        ),
      );
      process.exit(0);
    }

    // create new client (NewLibrary waits for channel readiness)
    const cryptoLib = await CryptoBrokerClient.NewLibrary();

    await execute(cryptoLib, parsed_args);
    while (parsed_args.delay) {
      try {
        await sleep(parsed_args.delay);
        await execute(cryptoLib, parsed_args);
      } catch (err) {
        const expectedErrors = [
          'ETIMEDOUT',
          'EOPENBREAKER',
          'ESEMLOCKED',
          'ESHUTDOWN',
          14,
          8,
          10,
        ];
        // we allow the expected circuit breaker errors
        // and service errors the circuit breaker is aware of
        if (hasErrorCode(expectedErrors, err)) {
          logger.error((err as Error).message);
          continue;
        }

        // otherwise re-throw everything else
        throw err;
      }
    }
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  } finally {
    await tracingProvider.shutdown();
    await loggingProvider.shutdown();
  }
}

main().catch((err) => {
  logger.error(`CLI Error: ${(err as Error).message}`);
});

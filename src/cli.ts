#!/usr/bin/env node
import 'reflect-metadata';
import { tracer, tracingProvider } from './otel/tracer.js';
import { loggingProvider } from './otel/logger.js';
import { context, SpanStatusCode, trace } from '@opentelemetry/api';
import { randomUUID } from 'crypto';
import { Bench } from 'tinybench';
import {
  BenchmarkPayload,
  CryptoBrokerClient,
  EncryptDataPayload,
  DecryptDataPayload,
  GIT_HASH as CLIENT_HASH,
  VERSION as CLIENT_VERSION,
  HashDataPayload,
  SignCertificatePayload,
} from '@open-crypto-broker/cryptobroker-client';
import { AttrCorrelationId } from './otel/attributes.js';

import {
  ArgumentDefaultsHelpFormatter,
  ArgumentParser,
  ArgumentTypeError,
} from 'argparse';
import { addHashDataParser, HashDataCommand } from './commands/hash_data.js';
import {
  addSignCertificateParser,
  SignCertificateCommand,
} from './commands/sign_certificate.js';
import {
  addEncryptDataParser,
  EncryptDataCommand,
} from './commands/encrypt_data.js';
import {
  addDecryptDataParser,
  DecryptDataCommand,
} from './commands/decrypt_data.js';
import { addLocalBenchmarkParser } from './commands/local_benchmark.js';
import { numToHexString } from './utils/conversions.js';
import { logger, DurationLogs } from './utils/logging.js';
import {
  addHealthDataParser,
  HealthDataCommand,
} from './commands/health_data.js';
import {
  addBenchmarkParser,
  BenchmarkCommand,
} from './commands/server_benchmark.js';
const durationLogs = new DurationLogs();

function hasErrorCode(code: (string | number)[], err: unknown): err is Error {
  return typeof err === 'object' && err !== null && code.includes(err['code']);
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

  // hash data command
  addHashDataParser(sub_parsers);

  // sign certificate command
  addSignCertificateParser(sub_parsers);

  // encrypt/decrypt data command
  addEncryptDataParser(sub_parsers);
  addDecryptDataParser(sub_parsers);

  // local benchmark command
  addLocalBenchmarkParser(sub_parsers);

  // server-side benchmark command
  addBenchmarkParser(sub_parsers);

  // health command
  addHealthDataParser(sub_parsers);

  return parser.parse_args();
}

async function execute(cryptoLib: CryptoBrokerClient, parsed_args) {
  const command: string = parsed_args.command;

  const commandMap = {
    'hash-data': {
      operator: HashDataCommand,
      executor: async (payload: HashDataPayload) => cryptoLib.hashData(payload),
    },
    'sign-certificate': {
      operator: SignCertificateCommand,
      executor: async (payload: SignCertificatePayload) =>
        cryptoLib.signCertificate(payload),
    },
    'encrypt-data': {
      operator: EncryptDataCommand,
      executor: async (payload: EncryptDataPayload) =>
        cryptoLib.encryptData(payload),
    },
    'decrypt-data': {
      operator: DecryptDataCommand,
      executor: async (payload: DecryptDataPayload) =>
        cryptoLib.decryptData(payload),
    },
    benchmark: {
      operator: BenchmarkCommand,
      executor: async (payload: BenchmarkPayload) =>
        cryptoLib.benchmarkData(payload),
    },
    health: {
      operator: HealthDataCommand,
      executor: async () => cryptoLib.healthData(),
    },
  };

  // Data hashing
  // Usage: cli.js [--loop <delay>] hash-data [--profile <profile>] <data>
  if (command in commandMap) {
    const op = new commandMap[command].operator(parsed_args);
    const span = tracer.startSpan(`CLI.${op.methodName}`, {
      attributes: op.getRequestAttributes(),
    });

    logger.info(`Executing ${op.methodName} using '${op.profile}' profile...`);
    const start = process.hrtime.bigint();
    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        // info if subject is provided in sign-certificate
        if (command === 'sign-certificate' && parsed_args.subject) {
          logger.info(`Note: The CSR subject will be overwritten by argument.`);
        }

        // request
        const response = await commandMap[command].executor({
          ...op.getPayload(),
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
        });

        // set additional tracing attributes
        span.setAttributes({
          [AttrCorrelationId]: response.metadata?.traceContext?.correlationId,
          ...op.getResponseAttributes(response),
        });

        console.log(JSON.stringify(response));
        span.setStatus({
          code: SpanStatusCode.OK,
          message: `${op.methodName} successful.`,
        });
      } catch (err) {
        if (err instanceof Error) {
          span.recordException(err);
          span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        }
        throw err;
      } finally {
        const end = process.hrtime.bigint();
        durationLogs.logDuration(op.methodName, start, end);
        span.end();
      }
    });
  } else {
    logger.error('Unknown Command');
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
          ['HashData', 'SignCertificate', 'HealthData'],
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

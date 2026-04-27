#!/usr/bin/env node
import 'reflect-metadata';
import { tracer, tracingProvider } from './otel/tracer.js';
import { loggingProvider } from './otel/logger.js';
import { context, trace, SpanStatusCode } from '@opentelemetry/api';
import {
  CryptoBrokerClient,
  BenchmarkPayload,
  CertEncoding,
  HashPayload,
  SignPayload,
  VERSION as CLIENT_VERSION,
  GIT_COMMIT as CLIENT_GIT_COMMIT,
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
  AttrCryptoSignedCertSize,
  AttrRpcMethod,
} from './otel/attributes.js';

import * as fs from 'fs';
import { randomUUID } from 'crypto';
import {
  ArgumentParser,
  ArgumentDefaultsHelpFormatter,
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

function logDuration(label: string, start: bigint, end: bigint) {
  const durationMicroS = (end - start) / BigInt(1000.0);
  logger.info(`${label} took ${durationMicroS} µs`);
}

function numToHexString(n: number): string {
  return n.toString(16).padStart(2, '0');
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

  // hash sub-parser and arguments
  const hash_parser = sub_parsers.add_parser('hash', {
    help: 'create a hash',
  });
  hash_parser.add_argument('--profile', {
    help: 'Profile Selection',
    default: 'Default',
  });
  hash_parser.add_argument('data');

  // sign sub-parser and arguments
  const sign_parser = sub_parsers.add_parser('sign', {
    help: 'sign a CSR etc',
  });
  sign_parser.add_argument('--profile', {
    help: 'Profile Selection',
    default: 'Default',
  });
  sign_parser.add_argument('--encoding', {
    default: CertEncoding.PEM,
    choices: CertEncoding,
    help: 'Specifies which encoding should be used for the signedCertificate',
  });
  sign_parser.add_argument('--subject', {
    help: 'Subject for the signing request (will overwrite the subject in the CSR)',
  });
  sign_parser.add_argument('--csr', {
    help: 'Path to CSR file',
    required: true,
  });
  sign_parser.add_argument('--caCert', {
    help: 'Path to CA certificate file',
    required: true,
  });
  sign_parser.add_argument('--caKey', {
    help: 'Path to CA private key file',
    required: true,
  });

  sub_parsers.add_parser('health', {
    help: 'request server health status',
  });

  sub_parsers.add_parser('benchmark', {
    help: 'request server-side benchmark',
  });

  return parser.parse_args();
}

// initializes the parsers
const parsed_args = init_parser();

async function execute(cryptoLib: CryptoBrokerClient) {
  const command: string = parsed_args.command;
  const profile: string = parsed_args.profile;

  // Data hashing
  // Usage: cli.js [--loop <delay>] hash [--profile <profile>] <data>
  if (command === 'hash') {
    const data: string = parsed_args.data;
    const span = tracer.startSpan('CLI.Hash', {
      attributes: {
        [AttrRpcMethod]: 'Hash',
        [AttrCryptoProfile]: profile,
        [AttrCryptoInputSize]: data.length,
      },
    });

    logger.info(`Hashing using '${profile}' profile...`);
    const start = process.hrtime.bigint();
    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        // prepare payload
        const payload: HashPayload = {
          profile: profile,
          input: Buffer.from(data),
          metadata: {
            id: randomUUID(),
            createdAt: new Date().toString(),
            traceContext: {
              traceId: span.spanContext().traceId,
              spanId: span.spanContext().spanId,
              traceFlags: numToHexString(span.spanContext().traceFlags),
              traceState: span.spanContext().traceState?.serialize() || '',
              correlationId: randomUUID(),
            },
          },
        };

        // hash request
        const hashResponse = await cryptoLib.hashData(payload);

        // set additional tracing attributes
        span.setAttributes({
          [AttrCorrelationId]:
            hashResponse.metadata?.traceContext?.correlationId,
          [AttrCryptoHashAlgorithm]: hashResponse.hashAlgorithm,
          [AttrCryptoHashOutputSize]: hashResponse.hashValue.length,
        });

        console.log(JSON.stringify(hashResponse, null, 2));
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
    // Usage: cli.js [--loop <delay>] sign [--profile <profile>] [--encoding={B64,PEM}] [--subject <subject>] --csr <path-to-csr> --caCert <path-to-caCert> --caKey <path-to-caKey>
  } else if (command === 'sign') {
    const csrPath = parsed_args.csr;
    const caCertPath = parsed_args.caCert;
    const signingKeyPath = parsed_args.caKey;
    const encoding: CertEncoding = parsed_args.encoding;
    const subject: string = parsed_args.subject;
    const options = {
      encoding: encoding,
    };
    const span = tracer.startSpan('CLI.Sign', {
      attributes: {
        [AttrRpcMethod]: 'Sign',
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

        const payload: SignPayload = {
          profile: profile,
          csr: csr,
          caPrivateKey: caPrivateKey,
          caCert: caCert,
          metadata: {
            id: randomUUID(),
            createdAt: new Date().toString(),
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
        };

        // add subject to payload if it was provided
        if (subject) {
          payload['subject'] = subject;
          logger.info(`Note: The CSR subject will be overwritten by argument.`);
        }
        // sign request
        const signResponse = await cryptoLib.signCertificate(payload, options);
        console.log(JSON.stringify(signResponse, null, 2));

        // set additional tracing attribute
        span.setAttributes({
          [AttrCorrelationId]:
            signResponse.metadata?.traceContext?.correlationId,
          [AttrCryptoSignedCertSize]: signResponse.signedCertificate.length,
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
        console.log(JSON.stringify(prettyData, null, 2));

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
            createdAt: new Date().toString(),
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
        console.log(JSON.stringify(prettyResponse, null, 2));

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

  if (parsed_args.command === 'version') {
    const CLI_VERSION =
      typeof __VERSION__ === 'undefined'
        ? '<unbundled-dev-version>'
        : __VERSION__;
    console.log(
      `Client library version: ${CLIENT_VERSION}@${CLIENT_GIT_COMMIT}\nCLI version: ${CLI_VERSION}@${__GIT_COMMIT__}`,
    );
    process.exit(0);
  }

  try {
    // create new client (NewLibrary waits for channel readiness)
    const cryptoLib = await CryptoBrokerClient.NewLibrary();

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    await execute(cryptoLib);
    while (parsed_args.delay) {
      await sleep(parsed_args.delay);
      await execute(cryptoLib);
    }
  } catch (err) {
    logger.error(err);
    process.exit(1);
  } finally {
    await tracingProvider.shutdown();
    await loggingProvider.shutdown();
  }
}

main().catch((err) => {
  logger.error(`Error: ${err}`);
});

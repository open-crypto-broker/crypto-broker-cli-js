#!/usr/bin/env node
import { tracer, tracingProvider } from './otel/tracer.js';
import { loggingProvider } from './otel/logger.js';
import { context, trace, SpanStatusCode } from '@opentelemetry/api';
import { CryptoBrokerClient, CertEncoding, } from 'cryptobroker-client';
import { AttrCryptoBenchmarkResultsSize, AttrCryptoCaCertSize, AttrCryptoCaKeySize, AttrCryptoCsrSize, AttrCryptoHashAlgorithm, AttrCryptoHashOutputSize, AttrCryptoInputSize, AttrCryptoProfile, AttrCryptoSignedCertSize, AttrRpcMethod, } from './otel/attributes.js';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { ArgumentParser, ArgumentDefaultsHelpFormatter, ArgumentTypeError, } from 'argparse';
import { HealthCheckResponse_ServingStatus } from 'cryptobroker-client';
import { createLogger, transports } from 'winston';
const logger = createLogger({
    transports: [new transports.Console()],
});
function logDuration(label, start, end) {
    const durationMicroS = (end - start) / BigInt(1000.0);
    logger.info(`${label} took ${durationMicroS} µs`);
}
function init_parser() {
    const parser = new ArgumentParser({
        formatter_class: ArgumentDefaultsHelpFormatter,
    });
    const sub_parsers = parser.add_subparsers({
        help: 'Command Selection',
        dest: 'command',
    });
    sub_parsers.required = true;
    // main parser arguments
    parser.add_argument('--profile', {
        help: 'Profile Selection',
        default: 'Default',
    });
    parser.add_argument('--loop', {
        help: 'Loops the request with the specified delay (in ms).',
        dest: 'delay',
        type: (arg) => {
            const int_arg = parseInt(arg);
            if (int_arg <= 0 || int_arg > 1000) {
                throw new ArgumentTypeError('The delay value must be between 1ms and 1000ms.');
            }
            return int_arg;
        },
    });
    // hash sub-parser and arguments
    const hash_parser = sub_parsers.add_parser('hash', {
        help: 'create a hash',
    });
    hash_parser.add_argument('data');
    // sign sub-parser and arguments
    const sign_parser = sub_parsers.add_parser('sign', {
        help: 'sign a CSR etc',
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
    sign_parser.add_argument('--encoding', {
        default: CertEncoding.PEM,
        choices: CertEncoding,
        help: 'Specifies which encoding should be used for the signedCertificate',
    });
    sign_parser.add_argument('--subject', {
        help: 'Subject for the signing request (will overwrite the subject in the CSR)',
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
async function execute(cryptoLib) {
    const command = parsed_args.command;
    const profile = parsed_args.profile;
    // Data hashing
    // Usage: cli.js [--profile <profile>] [--loop <delay>] hash <data>
    if (command === 'hash') {
        const data = parsed_args.data;
        const span = tracer.startSpan('CLI.Hash', {
            attributes: {
                [AttrRpcMethod]: 'Hash',
                [AttrCryptoProfile]: profile,
                [AttrCryptoInputSize]: data.length,
            },
        });
        console.log(`Hashing '${data}' using "${profile}" profile...`);
        const start = process.hrtime.bigint();
        return context.with(trace.setSpan(context.active(), span), async () => {
            try {
                // prepare payload
                const payload = {
                    profile: profile,
                    input: Buffer.from(data),
                    metadata: {
                        id: uuidv4(),
                        createdAt: new Date().toString(),
                        traceContext: {
                            traceId: span.spanContext().traceId,
                            spanId: span.spanContext().spanId,
                            traceFlags: span.spanContext().traceFlags.toString(),
                            traceState: span.spanContext().traceState?.serialize() || '',
                        },
                    },
                };
                // hash request
                const hashResponse = await cryptoLib.hashData(payload);
                // set additional tracing attributes
                span.setAttributes({
                    [AttrCryptoHashAlgorithm]: hashResponse.hashAlgorithm,
                    [AttrCryptoHashOutputSize]: hashResponse.hashValue.length,
                });
                // return only the hash if data-only is set
                if (parsed_args.data_only)
                    console.log(hashResponse.hashValue);
                console.log('Hash response:\n', JSON.stringify(hashResponse, null, 2));
                span.setStatus({ code: SpanStatusCode.OK });
            }
            catch (err) {
                if (err instanceof Error) {
                    span.recordException(err);
                    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
                }
                throw err;
            }
            finally {
                const end = process.hrtime.bigint();
                logDuration('Data Hashing', start, end);
                span.end();
            }
        });
        // Certificate signing
        // Usage: cli.js [--profile <profile>] [--loop <delay>] sign --csr <path-to-csr> --caCert <path-to-caCert> --caKey <path-to-caKey> [--encoding={B64,PEM}] [--subject SUBJECT]
    }
    else if (command === 'sign') {
        const csrPath = parsed_args.csr;
        const caCertPath = parsed_args.caCert;
        const signingKeyPath = parsed_args.caKey;
        const encoding = parsed_args.encoding;
        const subject = parsed_args.subject;
        const options = {
            encoding: encoding,
        };
        const span = tracer.startSpan('CLI.Sign', {
            attributes: {
                [AttrRpcMethod]: 'Sign',
                [AttrCryptoProfile]: profile,
            },
        });
        logger.info(`Signing certificate using "${profile}" profile...`);
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
                const payload = {
                    profile: profile,
                    csr: csr,
                    caPrivateKey: caPrivateKey,
                    caCert: caCert,
                    metadata: {
                        id: uuidv4(),
                        createdAt: new Date().toString(),
                    },
                    crlDistributionPoints: [
                        'http://example.com/crls/list1.crl',
                        'http://example.com/crls/list2.crl',
                    ],
                };
                // add subject to payload if it was provided
                if (subject) {
                    payload['subject'] = subject;
                    logger.info(`Note: The CSR subject will be overwritten by "${subject}".`);
                }
                // sign request
                const signResponse = await cryptoLib.signCertificate(payload, options);
                console.log('Sign response:\n', JSON.stringify(signResponse, null, 2));
                // set additional tracing attribute
                span.setAttribute(AttrCryptoSignedCertSize, signResponse.signedCertificate.length);
                span.setStatus({ code: SpanStatusCode.OK });
            }
            catch (err) {
                if (err instanceof Error) {
                    span.recordException(err);
                    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
                }
                throw err;
            }
            finally {
                const end = process.hrtime.bigint();
                logDuration('Certificate Signing', start, end);
                span.end();
            }
        });
        // Health Status
        // Usage: cli.js [--profile <profile>] [--loop <delay>] health
    }
    else if (command === 'health') {
        const span = tracer.startSpan('CLI.Health', {
            attributes: {
                [AttrRpcMethod]: 'Health',
            },
        });
        logger.info('Requesting server health status...');
        return context.with(trace.setSpan(context.active(), span), async () => {
            try {
                const health_data = await cryptoLib.healthData();
                logger.info('HealthCheck response:', JSON.stringify(health_data, null, 2));
                const serving_status = HealthCheckResponse_ServingStatus[health_data.status];
                logger.info('Status:', serving_status);
                span.setStatus({ code: SpanStatusCode.OK });
            }
            catch (err) {
                if (err instanceof Error) {
                    span.recordException(err);
                    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
                }
                throw err;
            }
            finally {
                span.end();
            }
        });
        // Server-side benchmark (self-test)
        // Usage: cli.js [--profile <profile>] benchmark
    }
    else if (command === 'benchmark') {
        const span = tracer.startSpan('CLI.Benchmark', {
            attributes: {
                [AttrRpcMethod]: 'Benchmark',
            },
        });
        logger.info('Running server-side benchmarks...');
        return context.with(trace.setSpan(context.active(), span), async () => {
            try {
                // prepare payload
                const payload = {
                    metadata: {
                        id: uuidv4(),
                        createdAt: new Date().toString(),
                        traceContext: {
                            traceId: span.spanContext().traceId,
                            spanId: span.spanContext().spanId,
                            traceFlags: span.spanContext().traceFlags.toString(),
                            traceState: span.spanContext().traceState?.serialize() || '',
                        },
                    },
                };
                // benchmark request
                const benchmarkResponse = await cryptoLib.benchmarkData(payload);
                console.log('Benchmark response:\n', JSON.stringify(benchmarkResponse, null, 2));
                // set additional tracing attribute
                span.setAttribute(AttrCryptoBenchmarkResultsSize, benchmarkResponse.benchmarkResults.length);
                span.setStatus({ code: SpanStatusCode.OK });
            }
            catch (err) {
                if (err instanceof Error) {
                    span.recordException(err);
                    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
                }
                throw err;
            }
            finally {
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
    try {
        // create new client
        const cryptoLib = new CryptoBrokerClient();
        // wait for the connection to become ready
        await cryptoLib.ready();
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        await execute(cryptoLib);
        while (parsed_args.delay) {
            await sleep(parsed_args.delay);
            await execute(cryptoLib);
        }
    }
    catch (err) {
        logger.error(err);
        process.exit(1);
    }
    finally {
        await tracingProvider.shutdown();
        await loggingProvider.shutdown();
    }
}
main().catch((err) => {
    logger.error('Error:', err);
});
//# sourceMappingURL=cli.js.map
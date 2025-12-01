#!/usr/bin/env node
import { CertEncoding, CryptoBrokerClient } from 'cryptobroker-client';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  ArgumentParser,
  ArgumentDefaultsHelpFormatter,
  ArgumentTypeError,
} from 'argparse';
import { HealthCheckResponse_ServingStatus } from '../../crypto-broker-client-js/dist/lib/proto/third_party/grpc/health/v1/health.js';

function logDuration(label: string, start: bigint, end: bigint) {
  const durationMicroS = (end - start) / BigInt(1000.0);
  console.log(`${label} took ${durationMicroS} µs`);
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

  sub_parsers.add_parser('status', {
    help: 'request server serving status',
  });

  return parser.parse_args();
}

// initializes the parsers
const parsed_args = init_parser();

async function execute(cryptoLib: CryptoBrokerClient) {
  const command: string = parsed_args.command;
  const profile: string = parsed_args.profile;

  // Data hashing
  // Usage: cli.js [--profile <profile>] [--loop <delay>] hash <data>
  if (command === 'hash') {
    const data: string = parsed_args.data;

    console.log(`Hashing '${data}' using "${profile}" profile`);
    const start = process.hrtime.bigint();
    const hashResponse = await cryptoLib.hashData({
      profile: profile,
      input: Buffer.from(data),
      metadata: {
        id: uuidv4(),
        createdAt: new Date().toString(),
      },
    });
    const end = process.hrtime.bigint();

    if (parsed_args.data_only) console.log(hashResponse.hashValue);
    console.log('Hashed response:\n', JSON.stringify(hashResponse, null, 2));
    logDuration('Data Hashing', start, end);

    // Certificate signing
    // Usage: cli.js [--profile <profile>] [--loop <delay>] sign --csr <path-to-csr> --caCert <path-to-caCert> --caKey <path-to-caKey> [--encoding={B64,PEM}] [--subject SUBJECT]
  } else if (command === 'sign') {
    const csrPath = parsed_args.csr;
    const caCertPath = parsed_args.caCert;
    const signingKeyPath = parsed_args.caKey;
    const encoding: CertEncoding = parsed_args.encoding;
    const subject: string = parsed_args.subject;
    const options = {
      encoding: encoding,
    };

    const csr = fs.readFileSync(csrPath, 'utf8');
    const caCert = fs.readFileSync(caCertPath, 'utf8');
    const caPrivateKey = fs.readFileSync(signingKeyPath, 'utf8');

    const payload = {
      profile: profile,
      csr: csr,
      caPrivateKey: caPrivateKey,
      caCert: caCert,
      metadata: {
        id: uuidv4(),
        createdAt: new Date().toString(),
      },
    };
    // add subject to payload if it was provided
    if (subject) {
      payload['subject'] = subject;
      console.log(`Note: The CSR subject will be overwritten by "${subject}".`);
    }

    // Starting certificate signing
    const start = process.hrtime.bigint();
    const signResponse = await cryptoLib.signCertificate(payload, options);
    const end = process.hrtime.bigint();
    console.log('Sign response:\n', JSON.stringify(signResponse, null, 2));
    logDuration('Certificate Signing', start, end);
    // Usage: cli.js [--profile <profile>] [--loop <delay>] status
  } else if (command === 'status') {
    console.log('Requesting serving status...');

    const health_resp = await cryptoLib.healthCheck();
    console.log(
      'HealthCheck response:\n',
      JSON.stringify(health_resp, null, 2),
    );
    const status_obj = HealthCheckResponse_ServingStatus[health_resp.status];
    console.log('Status: ', status_obj);
  }
}

async function main() {
  const cryptoLib = new CryptoBrokerClient();
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // signal handling
  process.on('SIGINT', () => {
    console.log('Received SIGINT, exiting...');
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, exiting...');
    process.exit(0);
  });

  await execute(cryptoLib);
  while (parsed_args.delay) {
    await sleep(parsed_args.delay);
    await execute(cryptoLib);
  }
}

main().catch((err) => {
  console.error('Error:', err);
});

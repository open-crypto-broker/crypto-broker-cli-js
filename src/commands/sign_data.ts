import { readFileSync } from 'node:fs';
import { Namespace, SubparsersAction } from 'argparse';
import {
  SignatureFormat,
  SignDataPayload,
} from '@open-crypto-broker/cryptobroker-client';
import { Command } from './command.js';
import {
  AttrCryptoInputSize,
  AttrCryptoProfile,
  AttrRpcMethod,
} from '../otel/attributes.js';
import { enumKeysToStringArray, parseHexBytes } from '../utils/conversions.js';

export function addSignDataParser(sub_parsers: SubparsersAction) {
  const parser = sub_parsers.add_parser('sign-data', { help: 'Signs data' });
  parser.add_argument('--profile', {
    help: 'Profile Selection',
    default: 'Default',
  });
  const keys = parser.add_mutually_exclusive_group({ required: true });
  keys.add_argument('--key', { help: 'Path to a PEM or DER private key' });
  keys.add_argument('--keyId', { help: 'KMS signing key identifier' });
  keys.add_argument('--keyRaw', {
    type: parseHexBytes,
    help: 'PEM or DER private key bytes in hexadecimal',
  });
  parser.add_argument('--signature-format', {
    choices: enumKeysToStringArray(SignatureFormat),
    type: (value: string) => value.toUpperCase(),
    help: 'Signature format (uses the profile setting when omitted)',
  });
  parser.add_argument('input', { help: 'UTF-8 text to sign' });
  return parser;
}

export class SignDataCommand implements Command {
  readonly methodName = 'SignData';
  profile: string;
  private args: Namespace;

  constructor(parsed_args: Namespace) {
    this.profile = parsed_args.profile;
    this.args = parsed_args;
  }

  getPayload(): SignDataPayload {
    return {
      profile: this.profile,
      keySource: {
        single:
          this.args.keyId != null
            ? { keyId: this.args.keyId }
            : {
                rawKey:
                  this.args.key != null
                    ? readFileSync(this.args.key)
                    : this.args.keyRaw,
              },
      },
      input: Buffer.from(this.args.input),
      ...(this.args.signature_format != null && {
        signatureFormat:
          SignatureFormat[
            this.args.signature_format as keyof typeof SignatureFormat
          ],
      }),
    };
  }

  getRequestAttributes() {
    return {
      [AttrRpcMethod]: this.methodName,
      [AttrCryptoProfile]: this.profile,
      [AttrCryptoInputSize]: Buffer.byteLength(this.args.input),
    };
  }

  getResponseAttributes() {
    return {};
  }
}

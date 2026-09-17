import { Namespace, SubparsersAction } from 'argparse';
import { Command } from './command.js';
import { AttrCryptoProfile, AttrRpcMethod } from '../otel/attributes.js';
import { EncryptDataPayload } from '@open-crypto-broker/cryptobroker-client';

export function addEncryptDataParser(sub_parsers: SubparsersAction) {
  const encryptData_parser = sub_parsers.add_parser('encrypt-data', {
    help: 'Encrypts data',
  });
  encryptData_parser.add_argument('--profile', {
    help: 'Profile Selection',
    default: 'Default',
  });
  const encryptData_key_group = encryptData_parser.add_mutually_exclusive_group(
    { required: true },
  );
  encryptData_key_group.add_argument('--keyId', {
    help: 'Specifies which key from the KMS is used for encryption',
  });
  encryptData_key_group.add_argument('--keyRaw', {
    type: (arg: string) => Buffer.from(arg, 'hex'),
    help: 'Specifies the raw key bytes to be used for encryption (hex-based)',
  });
  encryptData_parser.add_argument('--nonce', {
    required: true,
    type: (arg: string) => Buffer.from(arg, 'hex'),
    help: 'Specifies the nonce bytes to be used for encryption (hex-based)',
  });
  encryptData_parser.add_argument('--aad', {
    type: (arg: string) => Buffer.from(arg, 'hex'),
    help: 'Specifies additional authenticated data to bind to the ciphertext (hex-based)',
  });
  encryptData_parser.add_argument('plaintext', {
    help: 'Specifies the plaintext to be encrypted [Only string-based for this CLI.]',
  });
  return encryptData_parser;
}

export class EncryptDataCommand implements Command {
  readonly methodName = 'EncryptData';
  profile: string;
  keyId: string | undefined;
  keyRaw: Uint8Array | undefined;
  plaintext: string;
  nonce: Uint8Array;
  aad: Uint8Array | undefined;

  constructor(parsed_args: Namespace) {
    this.profile = parsed_args.profile;
    this.keyId = parsed_args.keyId;
    this.keyRaw = parsed_args.keyRaw;
    this.plaintext = parsed_args.plaintext;
    this.nonce = parsed_args.nonce;
    this.aad = parsed_args.aad;
  }

  getPayload(): EncryptDataPayload {
    return {
      profile: this.profile,
      keySource: {
        ...(this.keyId !== undefined && { keyId: this.keyId }),
        ...(this.keyRaw !== undefined && { rawKey: this.keyRaw }),
      },
      plaintext: Buffer.from(this.plaintext),
      encryptMetadata: {
        nonce: this.nonce,
        ...(this.aad !== undefined && { aad: this.aad }),
      },
    };
  }

  getRequestAttributes() {
    return {
      [AttrRpcMethod]: this.methodName,
      [AttrCryptoProfile]: this.profile,
    };
  }
  getResponseAttributes() {
    return {};
  }
}

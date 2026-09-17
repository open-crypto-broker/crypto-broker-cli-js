import {
  HashDataOutputFormat,
  HashDataPayload,
  HashDataResponse,
} from '@open-crypto-broker/cryptobroker-client';
import { Namespace, SubparsersAction } from 'argparse';
import { enumKeysToStringArray } from '../utils/conversions.js';
import {
  AttrCryptoHashAlgorithm,
  AttrCryptoHashOutputSize,
  AttrCryptoInputSize,
  AttrCryptoProfile,
  AttrRpcMethod,
} from '../otel/attributes.js';
import { Command } from './command.js';

export function addHashDataParser(sub_parsers: SubparsersAction) {
  const hashData_parser = sub_parsers.add_parser('hash-data', {
    help: 'Creates a hash',
  });
  hashData_parser.add_argument('--profile', {
    help: 'Profile Selection',
    default: 'Default',
  });
  hashData_parser.add_argument('--output-format', {
    default: 'HEX',
    choices: enumKeysToStringArray(HashDataOutputFormat),
    type: (str: string) => str.toUpperCase(),
    help: 'Specifies which encoding should be used for the hashing operation',
  });
  hashData_parser.add_argument('data');
  return hashData_parser;
}

export class HashDataCommand implements Command {
  readonly methodName = 'HashData';
  profile: string;
  data: string;
  format: string;

  constructor(parsed_args: Namespace) {
    this.profile = parsed_args.profile;
    this.data = parsed_args.data;
    this.format = parsed_args.output_format;
  }

  getPayload(): HashDataPayload {
    return {
      profile: this.profile,
      input: Buffer.from(this.data),
      outputFormat:
        HashDataOutputFormat[this.format] ?? HashDataOutputFormat.HEX,
    };
  }

  getRequestAttributes() {
    return {
      [AttrRpcMethod]: this.methodName,
      [AttrCryptoProfile]: this.profile,
      [AttrCryptoInputSize]: this.data.length,
    };
  }
  getResponseAttributes(response: HashDataResponse) {
    return {
      [AttrCryptoHashAlgorithm]: response.hashAlgorithm,
      [AttrCryptoHashOutputSize]:
        response.hashValueHex?.length ?? response.hashValueRaw?.length ?? 0,
    };
  }
}

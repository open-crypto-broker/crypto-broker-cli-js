import { HashDataOutputFormat, } from '@open-crypto-broker/cryptobroker-client';
import { enumKeysToStringArray } from '../utils/conversions.js';
import { AttrCryptoHashAlgorithm, AttrCryptoHashOutputSize, AttrCryptoInputSize, AttrCryptoProfile, AttrRpcMethod, } from '../otel/attributes.js';
export function addHashDataParser(sub_parsers) {
    const hashData_parser = sub_parsers.add_parser('hash-data', {
        help: 'Creates a hash',
    });
    hashData_parser.add_argument('--profile', {
        help: 'Profile Selection',
        default: 'Default',
    });
    hashData_parser.add_argument('--output-format', {
        default: 'HEX',
        choices: enumKeysToStringArray(HashDataOutputFormat, 'HASH_OUTPUT_FORMAT_'),
        type: (str) => str.toUpperCase(),
        help: 'Specifies which encoding should be used for the hashing operation',
    });
    hashData_parser.add_argument('data');
    return hashData_parser;
}
export class HashDataCommand {
    methodName = 'HashData';
    profile;
    data;
    format;
    constructor(parsed_args) {
        this.profile = parsed_args.profile;
        this.data = parsed_args.data;
        this.format = parsed_args.output_format;
    }
    getPayload() {
        return {
            profile: this.profile,
            input: Buffer.from(this.data),
            outputFormat: HashDataOutputFormat[this.format] ??
                HashDataOutputFormat.HASH_OUTPUT_FORMAT_HEX,
        };
    }
    getRequestAttributes() {
        return {
            [AttrRpcMethod]: this.methodName,
            [AttrCryptoProfile]: this.profile,
            [AttrCryptoInputSize]: this.data.length,
        };
    }
    getResponseAttributes(response) {
        return {
            [AttrCryptoHashAlgorithm]: response.descriptor?.algorithm,
            [AttrCryptoHashOutputSize]: response.hashValueHex?.length ?? response.hashValueRaw?.length ?? 0,
        };
    }
}
//# sourceMappingURL=hash-data.js.map
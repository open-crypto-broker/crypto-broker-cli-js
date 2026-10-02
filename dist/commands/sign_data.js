import { AttrCryptoProfile, AttrRpcMethod } from '../otel/attributes.js';
import { SignatureFormat, } from '@open-crypto-broker/cryptobroker-client';
import { enumKeysToStringArray } from '../utils/conversions.js';
export function addSigntDataParser(sub_parsers) {
    const signData_parser = sub_parsers.add_parser('sign-data', {
        help: 'Signs data',
    });
    signData_parser.add_argument('--profile', {
        help: 'Profile Selection',
        default: 'Default',
    });
    const signData_key_group = signData_parser.add_mutually_exclusive_group({
        required: true,
    });
    signData_key_group.add_argument('--keyId', {
        help: 'Specifies which key from the KMS is used for signing',
    });
    signData_key_group.add_argument('--keyRaw', {
        type: (arg) => Buffer.from(arg, 'hex'),
        help: 'Specifies the raw key bytes to be used for signing (hex-based)',
    });
    signData_parser.add_argument('--output-format', {
        default: 'HEX',
        choices: enumKeysToStringArray(SignatureFormat),
        type: (str) => str.toUpperCase(),
        help: 'Specifies which format should be used for the signing operation',
    });
    signData_parser.add_argument('input', {
        help: 'Specifies the input to be signed [Only string-based for this CLI.]',
    });
    return signData_parser;
}
export class SignDataCommand {
    methodName = 'SignData';
    profile;
    keyId;
    keyRaw;
    input;
    format;
    constructor(parsed_args) {
        this.profile = parsed_args.profile;
        this.keyId = parsed_args.keyId;
        this.keyRaw = parsed_args.keyRaw;
        this.input = parsed_args.input;
        this.format = parsed_args.signature_format;
    }
    getPayload() {
        return {
            profile: this.profile,
            keySource: {
                single: {
                    ...(this.keyId !== undefined && { keyId: this.keyId }),
                    ...(this.keyRaw !== undefined && { rawKey: this.keyRaw }),
                },
            },
            input: Buffer.from(this.input),
            signatureFormat: SignatureFormat[this.format] ?? SignatureFormat.SIGNATURE_RAW,
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
//# sourceMappingURL=sign_data.js.map
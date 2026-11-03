import { AttrCryptoProfile, AttrRpcMethod } from '../otel/attributes.js';
import { SignatureFormat, } from '@open-crypto-broker/cryptobroker-client';
import { enumKeysToStringArray } from '../utils/conversions.js';
export function addVerifyDataParser(sub_parsers) {
    const verifyData_parser = sub_parsers.add_parser('verify-data', {
        help: 'Verifies signed data',
    });
    verifyData_parser.add_argument('--profile', {
        help: 'Profile Selection',
        default: 'Default',
    });
    const verifyData_key_group = verifyData_parser.add_mutually_exclusive_group({
        required: true,
    });
    verifyData_key_group.add_argument('--keyId', {
        help: 'Specifies which key from the KMS was used for signing',
    });
    verifyData_key_group.add_argument('--keyRaw', {
        type: (arg) => Buffer.from(arg, 'hex'),
        help: 'Specifies the raw key bytes that were used for signing (hex-based)',
    });
    verifyData_parser.add_argument('--signature-format', {
        default: 'RAW',
        choices: enumKeysToStringArray(SignatureFormat, 'SIGNATURE_FORMAT_'),
        type: (str) => str.toUpperCase(),
        help: 'Specifies which format was used for the signing operation',
    });
    verifyData_parser.add_argument('input', {
        help: 'Specifies the input that was signed [Only string-based for this CLI.]',
    });
    verifyData_parser.add_argument('signature', {
        help: 'Specifies the signature to be verified (hex-based)',
    });
    return verifyData_parser;
}
export class VerifyDataCommand {
    methodName = 'VerifyData';
    profile;
    keyId;
    keyRaw;
    input;
    signature;
    format;
    constructor(parsed_args) {
        this.profile = parsed_args.profile;
        this.keyId = parsed_args.keyId;
        this.keyRaw = parsed_args.keyRaw;
        this.input = parsed_args.input;
        this.signature = parsed_args.signature;
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
            signature: Buffer.from(this.signature),
            signatureFormat: SignatureFormat[this.format] ?? SignatureFormat.SIGNATURE_FORMAT_RAW,
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
//# sourceMappingURL=verify-data.js.map
import { readFileSync } from 'node:fs';
import { SignatureFormat, } from '@open-crypto-broker/cryptobroker-client';
import { AttrCryptoInputSize, AttrCryptoProfile, AttrRpcMethod, } from '../otel/attributes.js';
import { enumKeysToStringArray, parseHexBytes } from '../utils/conversions.js';
export function addVerifyDataParser(sub_parsers) {
    const parser = sub_parsers.add_parser('verify-data', {
        help: 'Verifies a data signature',
    });
    parser.add_argument('--profile', {
        help: 'Profile Selection',
        default: 'Default',
    });
    const keys = parser.add_mutually_exclusive_group({ required: true });
    keys.add_argument('--key', { help: 'Path to a PEM or DER public key' });
    keys.add_argument('--keyId', { help: 'KMS verification key identifier' });
    keys.add_argument('--keyRaw', {
        type: parseHexBytes,
        help: 'PEM or DER public key bytes in hexadecimal',
    });
    parser.add_argument('--signature-format', {
        choices: enumKeysToStringArray(SignatureFormat),
        type: (value) => value.toUpperCase(),
        help: 'Signature format (uses the profile setting when omitted)',
    });
    parser.add_argument('input', { help: 'Signed UTF-8 text' });
    parser.add_argument('signature', {
        type: parseHexBytes,
        help: 'Signature bytes in hexadecimal, in the selected signature format',
    });
    return parser;
}
export class VerifyDataCommand {
    methodName = 'VerifyData';
    profile;
    args;
    constructor(parsed_args) {
        this.profile = parsed_args.profile;
        this.args = parsed_args;
    }
    getPayload() {
        return {
            profile: this.profile,
            keySource: {
                single: this.args.keyId != null
                    ? { keyId: this.args.keyId }
                    : {
                        rawKey: this.args.key != null
                            ? readFileSync(this.args.key)
                            : this.args.keyRaw,
                    },
            },
            input: Buffer.from(this.args.input),
            signature: this.args.signature,
            ...(this.args.signature_format != null && {
                signatureFormat: SignatureFormat[this.args.signature_format],
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
//# sourceMappingURL=verify_data.js.map
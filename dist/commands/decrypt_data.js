import { AttrCryptoProfile, AttrRpcMethod } from '../otel/attributes.js';
export function addDecryptDataParser(sub_parsers) {
    const decryptData_parser = sub_parsers.add_parser('decrypt-data', {
        help: 'Decrypts data',
    });
    decryptData_parser.add_argument('--profile', {
        help: 'Profile Selection',
        default: 'Default',
    });
    const decryptData_key_group = decryptData_parser.add_mutually_exclusive_group({ required: true });
    decryptData_key_group.add_argument('--keyId', {
        type: parseInt,
        help: 'Specifies which key from the KMS is used for decryption',
    });
    decryptData_key_group.add_argument('--keyRaw', {
        type: (arg) => Buffer.from(arg, 'hex'),
        help: 'Specifies the raw key bytes to be used for decryption (hex-based)',
    });
    decryptData_parser.add_argument('--nonce', {
        required: true,
        type: (arg) => Buffer.from(arg, 'hex'),
        help: 'Specifies the nonce bytes to be used for decryption (hex-based)',
    });
    decryptData_parser.add_argument('--aad', {
        type: (arg) => Buffer.from(arg, 'hex'),
        help: 'Specifies additional authenticated data for decryption (hex-based)',
    });
    decryptData_parser.add_argument('--tag', {
        type: (arg) => Buffer.from(arg, 'hex'),
        help: 'Specifies authentication tag for decryption (hex-based)',
    });
    decryptData_parser.add_argument('ciphertext', {
        type: (arg) => Buffer.from(arg, 'hex'),
        help: 'Specifies the ciphertext to be decrypted (hex-based)',
    });
    return decryptData_parser;
}
export class DecryptDataCommand {
    methodName = 'DecryptData';
    profile;
    keyId;
    keyRaw;
    ciphertext;
    nonce;
    aad;
    tag;
    constructor(parsed_args) {
        this.profile = parsed_args.profile;
        this.keyId = parsed_args.keyId;
        this.keyRaw = parsed_args.keyRaw;
        this.ciphertext = parsed_args.ciphertext;
        this.nonce = parsed_args.nonce;
        this.aad = parsed_args.aad;
        this.tag = parsed_args.tag;
    }
    getPayload() {
        return {
            profile: this.profile,
            keySource: {
                ...(this.keyId !== undefined && { keyId: this.keyId }),
                ...(this.keyRaw !== undefined && { rawKey: this.keyRaw }),
            },
            ciphertext: Buffer.from(this.ciphertext),
            decryptMetadata: {
                nonce: this.nonce,
                ...(this.aad !== undefined && { aad: this.aad }),
                ...(this.tag !== undefined && { tag: this.tag }),
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
//# sourceMappingURL=decrypt_data.js.map
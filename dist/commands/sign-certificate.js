import { enumKeysToStringArray } from '../utils/conversions.js';
import { SignCertificateOutputFormat, } from '@open-crypto-broker/cryptobroker-client';
import { AttrCryptoCaCertSize, AttrCryptoCsrSize, AttrCryptoProfile, AttrCryptoSignCertificateSize, AttrRpcMethod, } from '../otel/attributes.js';
import fs from 'fs';
export function addSignCertificateParser(sub_parsers) {
    const signCertificate_parser = sub_parsers.add_parser('sign-certificate', {
        help: 'Signs a CSR',
    });
    signCertificate_parser.add_argument('--profile', {
        help: 'Profile Selection',
        default: 'Default',
    });
    signCertificate_parser.add_argument('--encoding', {
        default: 'PEM',
        choices: enumKeysToStringArray(SignCertificateOutputFormat, 'SIGN_OUTPUT_FORMAT_'),
        type: (str) => str.toUpperCase(),
        help: 'Specifies which encoding should be used for the signing operation',
    });
    signCertificate_parser.add_argument('--subject', {
        help: 'Subject for the signing request (will overwrite the subject in the CSR)',
    });
    signCertificate_parser.add_argument('--csr', {
        help: 'Path to CSR file',
        required: true,
    });
    signCertificate_parser.add_argument('--caCert', {
        help: 'Path to CA certificate file',
        required: true,
    });
    const signCertificate_key_group = signCertificate_parser.add_mutually_exclusive_group({
        required: true,
    });
    signCertificate_key_group.add_argument('--keyId', {
        help: 'Specifies which CA key from the KMS is used',
    });
    signCertificate_key_group.add_argument('--keyFile', {
        help: 'Specifies the file path to the PEM-encoded CA key',
    });
    return signCertificate_parser;
}
export class SignCertificateCommand {
    methodName = 'SignCertificate';
    profile;
    csr;
    caCert;
    encoding;
    keyId;
    keyRaw;
    subject;
    constructor(parsed_args) {
        this.profile = parsed_args.profile;
        this.keyId = parsed_args.keyId;
        this.encoding = parsed_args.encoding;
        this.subject = parsed_args.subject;
        // get file contents
        this.csr = fs.readFileSync(parsed_args.csr, 'utf8');
        this.caCert = fs.readFileSync(parsed_args.caCert, 'utf8');
        this.keyRaw = fs.readFileSync(parsed_args.keyFile);
    }
    getPayload() {
        return {
            profile: this.profile,
            csr: this.csr,
            caCert: this.caCert,
            keySource: {
                single: {
                    ...(this.keyId !== undefined && { keyId: this.keyId }),
                    ...(this.keyRaw !== undefined && { rawKey: this.keyRaw }),
                },
            },
            ...(this.subject !== undefined && { subject: this.subject }),
            crlDistributionPoints: [
                'http://example.com/crls/list1.crl',
                'http://example.com/crls/list2.crl',
            ],
            outputFormat: SignCertificateOutputFormat[this.encoding] ??
                SignCertificateOutputFormat.SIGN_OUTPUT_FORMAT_PEM,
        };
    }
    getRequestAttributes() {
        return {
            [AttrRpcMethod]: 'SignCertificate',
            [AttrCryptoProfile]: this.profile,
            [AttrCryptoCsrSize]: this.csr.length,
            [AttrCryptoCaCertSize]: this.caCert.length,
        };
    }
    getResponseAttributes(response) {
        return {
            [AttrCryptoSignCertificateSize]: response.pem?.length ?? response.der?.length ?? 0,
        };
    }
}
//# sourceMappingURL=sign-certificate.js.map
import { Namespace, SubparsersAction } from 'argparse';
import { enumKeysToStringArray } from '../utils/conversions.js';
import {
  SignCertificateOutputFormat,
  SignCertificatePayload,
  SignCertificateResponse,
} from '@open-crypto-broker/cryptobroker-client';
import {
  AttrCryptoCaCertSize,
  AttrCryptoCaKeySize,
  AttrCryptoCsrSize,
  AttrCryptoProfile,
  AttrCryptoSignCertificateSize,
  AttrRpcMethod,
} from '../otel/attributes.js';
import fs from 'fs';
import { Command } from './command.js';

export function addSignCertificateParser(sub_parsers: SubparsersAction) {
  const signCertificate_parser = sub_parsers.add_parser('sign-certificate', {
    help: 'Signs a CSR',
  });
  signCertificate_parser.add_argument('--profile', {
    help: 'Profile Selection',
    default: 'Default',
  });
  signCertificate_parser.add_argument('--encoding', {
    default: 'PEM',
    choices: enumKeysToStringArray(SignCertificateOutputFormat),
    type: (str: string) => str.toUpperCase(),
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
  signCertificate_parser.add_argument('--caKey', {
    help: 'Path to CA private key file',
    required: true,
  });
  return signCertificate_parser;
}

export class SignCertificateCommand implements Command {
  readonly methodName = 'SignCertificate';
  profile: string;
  csr: string;
  caCert: string;
  caPrivateKey: string;
  encoding: string;
  subject: string | undefined;

  constructor(parsed_args: Namespace) {
    this.profile = parsed_args.profile;
    this.encoding = parsed_args.encoding;
    this.subject = parsed_args.subject;

    // get file contents
    this.csr = fs.readFileSync(parsed_args.csr, 'utf8');
    this.caCert = fs.readFileSync(parsed_args.caCert, 'utf8');
    this.caPrivateKey = fs.readFileSync(parsed_args.caKey, 'utf8');
  }

  getPayload(): SignCertificatePayload {
    return {
      profile: this.profile,
      csr: this.csr,
      caPrivateKey: this.caPrivateKey,
      caCert: this.caCert,
      ...(this.subject !== undefined && { subject: this.subject }),
      crlDistributionPoints: [
        'http://example.com/crls/list1.crl',
        'http://example.com/crls/list2.crl',
      ],
      outputFormat:
        SignCertificateOutputFormat[this.encoding] ??
        SignCertificateOutputFormat.PEM,
    };
  }

  getRequestAttributes() {
    return {
      [AttrRpcMethod]: 'SignCertificate',
      [AttrCryptoProfile]: this.profile,
      [AttrCryptoCsrSize]: this.csr.length,
      [AttrCryptoCaCertSize]: this.caCert.length,
      [AttrCryptoCaKeySize]: this.caPrivateKey.length,
    };
  }
  getResponseAttributes(response: SignCertificateResponse) {
    return {
      [AttrCryptoSignCertificateSize]:
        response.pem?.length ?? response.der?.length ?? 0,
    };
  }
}

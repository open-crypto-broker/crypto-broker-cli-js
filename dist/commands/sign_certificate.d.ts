import { Namespace, SubparsersAction } from 'argparse';
import { SignCertificatePayload, SignCertificateResponse } from '@open-crypto-broker/cryptobroker-client';
import { AttrCryptoCaCertSize, AttrCryptoCaKeySize, AttrCryptoCsrSize, AttrCryptoProfile, AttrCryptoSignCertificateSize, AttrRpcMethod } from '../otel/attributes.js';
import { Command } from './command.js';
export declare function addSignCertificateParser(sub_parsers: SubparsersAction): import("argparse").ArgumentParser;
export declare class SignCertificateCommand implements Command {
    readonly methodName = "SignCertificate";
    profile: string;
    csr: string;
    caCert: string;
    caPrivateKey: string;
    encoding: string;
    subject: string | undefined;
    constructor(parsed_args: Namespace);
    getPayload(): SignCertificatePayload;
    getRequestAttributes(): {
        [AttrRpcMethod]: string;
        [AttrCryptoProfile]: string;
        [AttrCryptoCsrSize]: number;
        [AttrCryptoCaCertSize]: number;
        [AttrCryptoCaKeySize]: number;
    };
    getResponseAttributes(response: SignCertificateResponse): {
        [AttrCryptoSignCertificateSize]: number;
    };
}

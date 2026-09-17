import { Namespace, SubparsersAction } from 'argparse';
import { Command } from './command.js';
import { AttrCryptoProfile, AttrRpcMethod } from '../otel/attributes.js';
import { EncryptDataPayload } from '@open-crypto-broker/cryptobroker-client';
export declare function addEncryptDataParser(sub_parsers: SubparsersAction): import("argparse").ArgumentParser;
export declare class EncryptDataCommand implements Command {
    readonly methodName = "EncryptData";
    profile: string;
    keyId: string | undefined;
    keyRaw: Uint8Array | undefined;
    plaintext: string;
    nonce: Uint8Array;
    aad: Uint8Array | undefined;
    constructor(parsed_args: Namespace);
    getPayload(): EncryptDataPayload;
    getRequestAttributes(): {
        [AttrRpcMethod]: string;
        [AttrCryptoProfile]: string;
    };
    getResponseAttributes(): {};
}

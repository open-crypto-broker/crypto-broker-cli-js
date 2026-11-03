import { Namespace, SubparsersAction } from 'argparse';
import { Command } from './command.js';
import { DecryptDataPayload } from '@open-crypto-broker/cryptobroker-client';
import { AttrCryptoProfile, AttrRpcMethod } from '../otel/attributes.js';
export declare function addDecryptDataParser(sub_parsers: SubparsersAction): import("argparse").ArgumentParser;
export declare class DecryptDataCommand implements Command {
    readonly methodName = "DecryptData";
    profile: string;
    keyId: string | undefined;
    keyRaw: Uint8Array | undefined;
    ciphertext: string;
    nonce: Uint8Array;
    aad: Uint8Array | undefined;
    tag: Uint8Array | undefined;
    constructor(parsed_args: Namespace);
    getPayload(): DecryptDataPayload;
    getRequestAttributes(): {
        [AttrRpcMethod]: string;
        [AttrCryptoProfile]: string;
    };
    getResponseAttributes(): {};
}

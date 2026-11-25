import { Namespace, SubparsersAction } from 'argparse';
import { Command } from './command.js';
import { AttrCryptoProfile, AttrRpcMethod } from '../otel/attributes.js';
import { VerifyDataPayload } from '@open-crypto-broker/cryptobroker-client';
export declare function addVerifyDataParser(sub_parsers: SubparsersAction): import("argparse").ArgumentParser;
export declare class VerifyDataCommand implements Command {
    readonly methodName = "VerifyData";
    profile: string;
    keyId: string | undefined;
    keyRaw: Uint8Array | undefined;
    input: string;
    signature: Uint8Array;
    format: string;
    constructor(parsed_args: Namespace);
    getPayload(): VerifyDataPayload;
    getRequestAttributes(): {
        [AttrRpcMethod]: string;
        [AttrCryptoProfile]: string;
    };
    getResponseAttributes(): {};
}

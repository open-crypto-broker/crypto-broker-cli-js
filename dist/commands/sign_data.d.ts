import { Namespace, SubparsersAction } from 'argparse';
import { Command } from './command.js';
import { AttrCryptoProfile, AttrRpcMethod } from '../otel/attributes.js';
import { SignDataPayload } from '@open-crypto-broker/cryptobroker-client';
export declare function addSigntDataParser(sub_parsers: SubparsersAction): import("argparse").ArgumentParser;
export declare class SignDataCommand implements Command {
    readonly methodName = "SignData";
    profile: string;
    keyId: string | undefined;
    keyRaw: Uint8Array | undefined;
    input: string;
    format: string;
    constructor(parsed_args: Namespace);
    getPayload(): SignDataPayload;
    getRequestAttributes(): {
        [AttrRpcMethod]: string;
        [AttrCryptoProfile]: string;
    };
    getResponseAttributes(): {};
}

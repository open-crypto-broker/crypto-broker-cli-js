import { Namespace, SubparsersAction } from 'argparse';
import { SignDataPayload } from '@open-crypto-broker/cryptobroker-client';
import { Command } from './command.js';
import { AttrCryptoInputSize, AttrCryptoProfile, AttrRpcMethod } from '../otel/attributes.js';
export declare function addSignDataParser(sub_parsers: SubparsersAction): import("argparse").ArgumentParser;
export declare class SignDataCommand implements Command {
    readonly methodName = "SignData";
    profile: string;
    private args;
    constructor(parsed_args: Namespace);
    getPayload(): SignDataPayload;
    getRequestAttributes(): {
        [AttrRpcMethod]: string;
        [AttrCryptoProfile]: string;
        [AttrCryptoInputSize]: number;
    };
    getResponseAttributes(): {};
}

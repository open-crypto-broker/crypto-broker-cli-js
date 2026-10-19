import { Namespace, SubparsersAction } from 'argparse';
import { VerifyDataPayload } from '@open-crypto-broker/cryptobroker-client';
import { Command } from './command.js';
import { AttrCryptoInputSize, AttrCryptoProfile, AttrRpcMethod } from '../otel/attributes.js';
export declare function addVerifyDataParser(sub_parsers: SubparsersAction): import("argparse").ArgumentParser;
export declare class VerifyDataCommand implements Command {
    readonly methodName = "VerifyData";
    profile: string;
    private args;
    constructor(parsed_args: Namespace);
    getPayload(): VerifyDataPayload;
    getRequestAttributes(): {
        [AttrRpcMethod]: string;
        [AttrCryptoProfile]: string;
        [AttrCryptoInputSize]: number;
    };
    getResponseAttributes(): {};
}

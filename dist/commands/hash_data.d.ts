import { HashDataPayload, HashDataResponse } from '@open-crypto-broker/cryptobroker-client';
import { Namespace, SubparsersAction } from 'argparse';
import { AttrCryptoHashAlgorithm, AttrCryptoHashOutputSize, AttrCryptoInputSize, AttrCryptoProfile, AttrRpcMethod } from '../otel/attributes.js';
import { Command } from './command.js';
export declare function addHashDataParser(sub_parsers: SubparsersAction): import("argparse").ArgumentParser;
export declare class HashDataCommand implements Command {
    readonly methodName = "HashData";
    profile: string;
    data: string;
    format: string;
    constructor(parsed_args: Namespace);
    getPayload(): HashDataPayload;
    getRequestAttributes(): {
        [AttrRpcMethod]: string;
        [AttrCryptoProfile]: string;
        [AttrCryptoInputSize]: number;
    };
    getResponseAttributes(response: HashDataResponse): {
        [AttrCryptoHashAlgorithm]: string;
        [AttrCryptoHashOutputSize]: number;
    };
}

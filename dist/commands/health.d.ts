import { Command } from './command.js';
import { Namespace, SubparsersAction } from 'argparse';
import { AttrRpcMethod } from '../otel/attributes.js';
export declare function addHealthDataParser(sub_parsers: SubparsersAction): void;
export declare class HealthDataCommand implements Command {
    readonly methodName = "HealthData";
    profile: string;
    constructor(parsed_args: Namespace);
    getPayload(): {};
    getRequestAttributes(): {
        [AttrRpcMethod]: string;
    };
    getResponseAttributes(): {};
}

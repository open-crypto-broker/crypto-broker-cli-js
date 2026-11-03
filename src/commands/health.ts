import { Command } from './command.js';
import { Namespace, SubparsersAction } from 'argparse';
import { AttrRpcMethod } from '../otel/attributes.js';

/*enum ServingStatus {
  UNKNOWN = 0,
  SERVING = 1,
  NOT_SERVING = 2,
  /!** SERVICE_UNKNOWN - Used only by the Watch method. *!/
  SERVICE_UNKNOWN = 3,
  UNRECOGNIZED = -1,
}*/

export function addHealthDataParser(sub_parsers: SubparsersAction) {
  sub_parsers.add_parser('health', {
    help: 'request server health status',
  });
}
export class HealthDataCommand implements Command {
  readonly methodName = 'HealthData';
  profile: string;

  constructor(parsed_args: Namespace) {
    this.profile = parsed_args.profile;
  }

  getPayload() {
    return {};
  }

  getRequestAttributes() {
    return {
      [AttrRpcMethod]: this.methodName,
    };
  }
  getResponseAttributes() {
    return {};
  }
}

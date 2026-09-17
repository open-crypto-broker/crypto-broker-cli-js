export interface Command {
    readonly methodName: string;
    profile: string;
    getPayload(): any;
    getRequestAttributes(): Record<string, string | number>;
    getResponseAttributes(response: any): Record<string, string | number>;
}

export interface Command {
  readonly methodName: string;
  profile: string;

  getPayload();
  getRequestAttributes(): Record<string, string | number>;
  getResponseAttributes(response): Record<string, string | number>;
}

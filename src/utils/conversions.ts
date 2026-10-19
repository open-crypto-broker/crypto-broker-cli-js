import { ArgumentTypeError } from 'argparse';

export function parseHexBytes(value: string): Buffer {
  if (!/^(?:[0-9a-fA-F]{2})+$/.test(value)) {
    throw new ArgumentTypeError(
      'Expected non-empty hexadecimal bytes (two digits per byte).',
    );
  }
  return Buffer.from(value, 'hex');
}

export function numToHexString(n: number): string {
  return n.toString(16).padStart(2, '0');
}

export function enumKeysToStringArray<
  E extends Record<string, string | number>,
>(enumType: E) {
  return Object.keys(enumType)
    .filter((key) => isNaN(Number(key)))
    .filter((key) => key !== 'UNRECOGNIZED'); // do not use -1
}

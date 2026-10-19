import { ArgumentTypeError } from 'argparse';
export function parseHexBytes(value) {
    if (!/^(?:[0-9a-fA-F]{2})+$/.test(value)) {
        throw new ArgumentTypeError('Expected non-empty hexadecimal bytes (two digits per byte).');
    }
    return Buffer.from(value, 'hex');
}
export function numToHexString(n) {
    return n.toString(16).padStart(2, '0');
}
export function enumKeysToStringArray(enumType) {
    return Object.keys(enumType)
        .filter((key) => isNaN(Number(key)))
        .filter((key) => key !== 'UNRECOGNIZED'); // do not use -1
}
//# sourceMappingURL=conversions.js.map
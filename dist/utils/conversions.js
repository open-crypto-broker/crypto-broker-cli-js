export function numToHexString(n) {
    return n.toString(16).padStart(2, '0');
}
export function enumKeysToStringArray(enumType) {
    return Object.keys(enumType)
        .filter((key) => isNaN(Number(key)))
        .filter((key) => key !== 'UNRECOGNIZED'); // do not use -1
}
//# sourceMappingURL=conversions.js.map
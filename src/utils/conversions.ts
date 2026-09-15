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

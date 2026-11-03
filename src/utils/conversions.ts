export function numToHexString(n: number): string {
  return n.toString(16).padStart(2, '0');
}

export function enumKeysToStringArray<
  E extends Record<string, string | number>,
>(enumType: E, prefix: string | undefined = '') {
  const filtered_keys = Object.keys(enumType)
    .filter((key) => isNaN(Number(key)))
    .filter((key) => key !== 'UNRECOGNIZED') // do not use -1
    .filter((key) => key !== prefix + 'UNSPECIFIED'); // do not use 0

  // removes prefixes
  const short_keys: string[] = [];
  filtered_keys.forEach((key) => short_keys.push(key.replace(prefix, '')));
  return short_keys;
}

export function PEMToBytes(pem: string): Uint8Array {
  return Buffer.from(
    pem.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s/g, '').trim(),
    'base64',
  );
}

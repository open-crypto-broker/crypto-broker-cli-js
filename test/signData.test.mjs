import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ArgumentParser } from 'argparse';
import { SignatureFormat } from '@open-crypto-broker/cryptobroker-client';
import {
  addSignDataParser,
  SignDataCommand,
} from '../dist/commands/sign_data.js';
import {
  addVerifyDataParser,
  VerifyDataCommand,
} from '../dist/commands/verify_data.js';

function parse(args) {
  const parser = new ArgumentParser({ exit_on_error: false });
  parser.error = (message) => {
    throw new Error(message);
  };
  const commands = parser.add_subparsers({ dest: 'command' });
  addSignDataParser(commands).error = parser.error;
  addVerifyDataParser(commands).error = parser.error;
  return parser.parse_args(args);
}

for (const [name, Command, tail] of [
  ['sign-data', SignDataCommand, []],
  ['verify-data', VerifyDataCommand, ['aB01']],
]) {
  test(`${name}: preserves key identifiers, UTF-8 input and profile defaults`, () => {
    const command = new Command(
      parse([name, '--keyId', 'kms/signing/key-1', 'café', ...tail]),
    );
    assert.deepEqual(command.getPayload(), {
      profile: 'Default',
      keySource: { single: { keyId: 'kms/signing/key-1' } },
      input: Buffer.from('café'),
      ...(name === 'verify-data' && { signature: Buffer.from('ab01', 'hex') }),
    });
    assert.deepEqual(command.getRequestAttributes(), {
      'rpc.method': command.methodName,
      'crypto.profile': 'Default',
      'crypto.input_size': 5,
    });
    assert.deepEqual(command.getResponseAttributes({ valid: false }), {});
  });

  test(`${name}: uses raw key bytes and each explicit signature format`, () => {
    for (const format of [
      'SIGNATURE_RAW',
      'SIGNATURE_DER',
      'SIGNATURE_PEM',
      'SIGNATURE_CMS',
    ]) {
      const command = new Command(
        parse([
          name,
          '--profile',
          'Custom',
          '--keyRaw',
          '00aBff',
          '--signature-format',
          format.toLowerCase(),
          'message',
          ...tail,
        ]),
      );
      const payload = command.getPayload();
      assert.equal(payload.profile, 'Custom');
      assert.deepEqual(payload.keySource, {
        single: { rawKey: Buffer.from('00abff', 'hex') },
      });
      assert.equal(payload.signatureFormat, SignatureFormat[format]);
    }
  });

  test(`${name}: requires exactly one key and a known format`, () => {
    assert.throws(() => parse([name, 'message', ...tail]));
    for (const keys of [
      ['--key', 'key.pem', '--keyId', 'id'],
      ['--key', 'key.pem', '--keyRaw', 'ab'],
      ['--keyId', 'id', '--keyRaw', 'ab'],
    ])
      assert.throws(() => parse([name, ...keys, 'message', ...tail]));
    assert.throws(() =>
      parse([
        name,
        '--keyId',
        'id',
        '--signature-format',
        'HEX',
        'message',
        ...tail,
      ]),
    );
    assert.throws(() =>
      parse([
        name,
        '--keyId',
        'id',
        '--signature-format',
        'UNRECOGNIZED',
        'message',
        ...tail,
      ]),
    );
  });

  test(`${name}: rejects empty, odd, partial and non-hexadecimal key bytes`, () => {
    for (const value of ['', 'a', 'ab1', 'abzz', '0xab', 'ab cd']) {
      assert.throws(
        () => parse([name, '--keyRaw', value, 'message', ...tail]),
        /hexadecimal bytes/,
      );
    }
  });

  test(`${name}: reads PEM and DER files without changing key bytes`, async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'ocb-sign-data-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const { privateKey, publicKey } = generateKeyPairSync('ec', {
      namedCurve: 'secp384r1',
    });
    const key = name === 'sign-data' ? privateKey : publicKey;
    const type = name === 'sign-data' ? 'pkcs8' : 'spki';
    for (const format of ['pem', 'der']) {
      const bytes = Buffer.from(key.export({ type, format }));
      const path = join(dir, `key.${format}`);
      await writeFile(path, bytes, { mode: 0o600 });
      const command = new Command(
        parse([name, '--key', path, 'message', ...tail]),
      );
      assert.deepEqual(command.getPayload().keySource, {
        single: { rawKey: bytes },
      });
      const attributes = JSON.stringify(command.getRequestAttributes());
      assert.ok(!attributes.includes(path));
      assert.ok(!attributes.includes(bytes.toString('hex')));
    }
    const missing = new Command(
      parse([name, '--key', join(dir, 'missing.pem'), 'message', ...tail]),
    );
    assert.throws(() => missing.getPayload(), { code: 'ENOENT' });
  });
}

test('verify-data: requires a complete hexadecimal signature', () => {
  assert.throws(() => parse(['verify-data', '--keyId', 'id', 'message']));
  for (const signature of ['', 'f', 'ab0', 'abzz', '0xab', 'ab cd']) {
    assert.throws(
      () => parse(['verify-data', '--keyId', 'id', 'message', signature]),
      /hexadecimal bytes/,
    );
  }
});

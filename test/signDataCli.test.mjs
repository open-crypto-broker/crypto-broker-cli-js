import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import process from 'node:process';
import test from 'node:test';
import { URL } from 'node:url';

async function runCli(args, rpcError = false) {
  const child = fork(new URL('../dist/cli.js', import.meta.url), args, {
    execArgv: [
      '--import',
      new URL('./fixtures/signDataClient.mjs', import.meta.url).href,
    ],
    env: {
      ...process.env,
      OTEL_TRACES_EXPORTER: 'none',
      OTEL_LOGS_EXPORTER: 'none',
      CLI_TEST_RPC_ERROR: rpcError ? '1' : '0',
    },
    silent: true,
    serialization: 'advanced',
    timeout: 10000,
  });
  const requests = [];
  let stdout = '';
  let stderr = '';
  child.on('message', (request) => requests.push(request));
  child.stdout.setEncoding('utf8').on('data', (text) => (stdout += text));
  child.stderr.setEncoding('utf8').on('data', (text) => (stderr += text));
  const [code, signal] = await once(child, 'close');
  assert.equal(signal, null, stderr);
  return {
    code,
    requests,
    rows: stdout.trim().split('\n').filter(Boolean).map(JSON.parse),
  };
}

for (const [name, method, tail, response] of [
  [
    'sign-data',
    'SignData',
    [],
    { signature: { type: 'Buffer', data: [171, 1] } },
  ],
  ['verify-data', 'VerifyData', ['ab01'], { valid: true }],
]) {
  test(`${name}: CLI dispatches the payload and prints the response`, async () => {
    const { code, requests, rows } = await runCli([
      name,
      '--profile',
      'Custom',
      '--keyRaw',
      '00abff',
      'message',
      ...tail,
    ]);
    assert.equal(code, 0);
    assert.equal(requests.length, 1);
    const [{ method: actualMethod, payload }] = requests;
    assert.equal(actualMethod, method);
    assert.equal(payload.profile, 'Custom');
    assert.deepEqual(payload.keySource, {
      single: { rawKey: Buffer.from('00abff', 'hex') },
    });
    assert.deepEqual(payload.input, Buffer.from('message'));
    if (name === 'verify-data')
      assert.deepEqual(payload.signature, Buffer.from('ab01', 'hex'));
    assert.match(payload.metadata.id, /^[0-9a-f-]{36}$/);
    assert.match(payload.metadata.traceContext.traceId, /^[0-9a-f]{32}$/);
    assert.deepEqual(
      rows.filter((row) => 'signature' in row || 'valid' in row),
      [response],
    );
  });

  test(`${name}: CLI returns exit code 1 for an RPC error`, async () => {
    const { code, requests, rows } = await runCli(
      [name, '--keyRaw', 'ab', 'message', ...tail],
      true,
    );
    assert.equal(code, 1);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].method, method);
    assert.ok(
      rows.some(
        (row) =>
          row.level === 'error' && row.message === 'Signing test RPC rejected',
      ),
    );
    assert.ok(rows.every((row) => !('signature' in row) && !('valid' in row)));
  });
}

test('verify-data: CLI preserves valid:false with exit code 0', async () => {
  const { code, requests, rows } = await runCli([
    'verify-data',
    '--keyRaw',
    'ab',
    'changed message',
    'ab01',
  ]);
  assert.equal(code, 0);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, 'VerifyData');
  assert.deepEqual(
    rows.filter((row) => 'valid' in row),
    [{ valid: false }],
  );
});

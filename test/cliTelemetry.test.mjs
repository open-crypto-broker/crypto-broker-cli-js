import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { clearTimeout, setTimeout } from 'node:timers';
import { fileURLToPath, URL } from 'node:url';

import { Server, ServerCredentials, status } from '@grpc/grpc-js';
import {
  HashDataResponse,
  SignCertificateResponse,
} from '@open-crypto-broker/cryptobroker-client';
import { build } from 'esbuild';

test(
  'CLI exports telemetry before it exits',
  {
    timeout: 60_000,
    skip: process.platform === 'win32' && 'The client uses a Unix socket',
  },
  async (t) => {
    const socketDir = '/tmp/open-crypto-broker';
    const socket = join(socketDir, 'crypto-broker-server.sock');
    // shortcut: use the fixed client socket until its address is configurable.
    assert.ok(
      !existsSync(socket),
      `Test requires an unused client socket: ${socket}`,
    );
    await mkdir(socketDir, { recursive: true });
    const dir = await mkdtemp(join(tmpdir(), 'ocb-cli-telemetry-'));
    const bundled = join(dir, 'cli.cjs');
    const unbundled = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
    await build({
      entryPoints: [unbundled],
      outfile: bundled,
      bundle: true,
      platform: 'node',
      format: 'cjs',
    });

    const received = [];
    const collector = createServer(async (request, response) => {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      received.push(JSON.parse(Buffer.concat(chunks).toString()));
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('{}');
    });
    await new Promise((resolve) => collector.listen(0, '127.0.0.1', resolve));
    const endpoint = `http://127.0.0.1:${collector.address().port}`;

    let handleRequest;
    const server = new Server();
    const unary = {
      requestStream: false,
      responseStream: false,
      requestSerialize: (value) => value,
      requestDeserialize: (value) => value,
      responseSerialize: (value) => value,
      responseDeserialize: (value) => value,
    };
    server.addService(
      {
        hashData: {
          path: '/CryptoBroker.CryptoGrpc/HashData',
          ...unary,
        },
        signCertificate: {
          path: '/CryptoBroker.CryptoGrpc/SignCertificate',
          ...unary,
        },
      },
      {
        hashData: (call, callback) =>
          handleRequest(call, callback, hashResponse),
        signCertificate: (call, callback) =>
          handleRequest(call, callback, certificateResponse),
      },
    );
    t.after(async () => {
      server.forceShutdown();
      await new Promise((resolve) => collector.close(resolve));
      await rm(dir, { recursive: true, force: true });
    });
    await new Promise((resolve, reject) =>
      server.bindAsync(
        `unix:${socket}`,
        ServerCredentials.createInsecure(),
        (error) => (error ? reject(error) : resolve()),
      ),
    );

    const hashResponse = Buffer.from(
      HashDataResponse.encode(
        HashDataResponse.create({
          hashAlgorithm: 'test',
          hashValueHex: 'test-hash',
        }),
      ).finish(),
    );
    const certificateResponse = Buffer.from(
      SignCertificateResponse.encode(
        SignCertificateResponse.create({ pem: 'test-certificate' }),
      ).finish(),
    );
    async function run(
      args,
      {
        entry = bundled,
        error = false,
        signal,
        signalAfter = 1,
        traces = 'otlphttp',
        logs = 'otlphttp',
        useDefaults = false,
      } = {},
    ) {
      received.length = 0;
      let stdout = '',
        stderr = '',
        reply,
        traceparent,
        requests = 0,
        pendingResponse;
      const env = Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) => !key.startsWith('OTEL_') && key !== 'NODE_OPTIONS',
        ),
      );
      const child = spawn(process.execPath, [entry, ...args], {
        cwd: dir,
        env: {
          ...env,
          ...(!useDefaults && {
            OTEL_TRACES_EXPORTER: traces,
            OTEL_LOGS_EXPORTER: logs,
          }),
          OTEL_TRACES_SAMPLER: 'always_on',
          OTEL_SERVICE_NAME: 'cli-telemetry-test',
          OTEL_EXPORTER_OTLP_ENDPOINT: endpoint,
          OTEL_EXPORTER_OTLP_HEADERS_AUTHORIZATION: '',
          OTEL_BSP_SCHEDULE_DELAY: '60000',
          OTEL_BLRP_SCHEDULE_DELAY: '60000',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const timer = setTimeout(() => child.kill('SIGKILL'), 8_000);
      handleRequest = (call, callback, response) => {
        requests++;
        traceparent = call.metadata.get('traceparent')[0];
        if (signal && requests === signalAfter) {
          reply = callback;
          pendingResponse = response;
          child.kill(signal);
        } else if (error) {
          callback({
            code: status.INVALID_ARGUMENT,
            details: 'test command error',
          });
        } else callback(null, response);
      };
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
        if (reply && stdout.includes(`Received ${signal}`)) {
          const callback = reply;
          reply = undefined;
          callback(null, pendingResponse);
        }
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
      const exit = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', (code, signal) => resolve({ code, signal }));
      }).finally(() => clearTimeout(timer));
      assert.equal(exit.signal, null, stderr);
      const spans = received.flatMap((body) =>
        (body.resourceSpans ?? []).flatMap((resource) =>
          resource.scopeSpans.flatMap((scope) => scope.spans),
        ),
      );
      const records = received.flatMap((body) =>
        (body.resourceLogs ?? []).flatMap((resource) =>
          resource.scopeLogs.flatMap((scope) => scope.logRecords),
        ),
      );
      return { ...exit, stdout, stderr, spans, records, traceparent, requests };
    }
    function commandSpan(result, name, code, count = 1) {
      const spans = result.spans.filter((span) => span.name === `CLI.${name}`);
      assert.equal(spans.length, count, `Expected exported CLI.${name} spans`);
      for (const span of spans) {
        assert.equal(span.status.code, code);
        if (code === 2)
          assert.ok(span.events.some((event) => event.name === 'exception'));
      }
      return spans[0];
    }

    for (const [name, entry] of [
      ['bundled', bundled],
      ['unbundled', unbundled],
    ]) {
      await t.test(
        `${name}: success exports each log once with trace context`,
        async () => {
          const result = await run(['hash-data', 'test'], { entry });
          assert.equal(result.code, 0);
          const span = commandSpan(result, 'HashData', 1);
          assert.equal(
            result.records.length,
            2,
            'Expected two exported CLI log records',
          );
          const duration = result.records.find((record) =>
            record.body.stringValue.startsWith('HashData took'),
          );
          assert.equal(duration.traceId, span.traceId);
          assert.equal(duration.spanId, span.spanId);
          assert.equal(
            result.traceparent,
            `00-${span.traceId}-${span.spanId}-01`,
          );
        },
      );
      await t.test(
        `${name}: command error exports its error span`,
        async () => {
          const result = await run(['hash-data', 'test'], {
            entry,
            error: true,
          });
          assert.equal(result.code, 1);
          commandSpan(result, 'HashData', 2);
          assert.ok(
            result.records.some((record) =>
              record.body.stringValue.includes('test command error'),
            ),
          );
        },
      );
    }
    for (const signal of ['SIGTERM', 'SIGINT']) {
      await t.test(
        `${signal}: finish an active call and export before stopping the loop`,
        async () => {
          const result = await run(['--loop', '1', 'hash-data', 'test'], {
            signal,
          });
          assert.equal(result.code, 0);
          commandSpan(result, 'HashData', 1);
          assert.ok(
            result.stdout.includes('test-hash'),
            'Active request must finish',
          );
          assert.ok(
            result.records.some((record) =>
              record.body.stringValue.includes(`Received ${signal}`),
            ),
          );
        },
      );
    }
    await t.test('SIGTERM exports all three buffered loop spans', async () => {
      const result = await run(['--loop', '1', 'hash-data', 'test'], {
        signal: 'SIGTERM',
        signalAfter: 3,
      });
      assert.equal(result.code, 0);
      assert.equal(result.requests, 3);
      commandSpan(result, 'HashData', 1, 3);
    });
    const files = ['csr', 'caCert', 'caKey'];
    for (const file of files)
      await writeFile(join(dir, file), 'public test input');
    for (const [name, entry] of [
      ['bundled', bundled],
      ['unbundled', unbundled],
    ]) {
      for (const [method, args, expected] of [
        [
          'HashData',
          ['hash-data', '--output-format=hex', 'test'],
          { hashValueHex: 'test-hash' },
        ],
        [
          'SignCertificate',
          [
            'sign-certificate',
            '--encoding=pem',
            ...files.flatMap((file) => [`--${file}`, join(dir, file)]),
          ],
          { pem: 'test-certificate' },
        ],
      ]) {
        await t.test(
          `${name}: default console exporters preserve ${method} JSON output`,
          async () => {
            const result = await run(args, { entry, useDefaults: true });
            assert.equal(result.code, 0, result.stderr);
            // Each top-level object can contain pretty-printed JSON.
            const output = result.stdout
              .trim()
              .split(/\n(?=\{)/)
              .map(JSON.parse);
            const [key, value] = Object.entries(expected)[0];
            assert.equal(
              output.filter((item) => item[key] === value).length,
              1,
            );
            const spans = output.filter(
              (item) => item.name === `CLI.${method}`,
            );
            assert.equal(spans.length, 1);
            const records = output.filter(
              (item) => typeof item.body === 'string',
            );
            assert.equal(records.length, 2);
            for (const record of records) {
              assert.equal(record.traceId, spans[0].traceId);
              assert.equal(record.spanId, spans[0].id);
            }
          },
        );
      }
    }
    for (const missing of files) {
      await t.test(
        `missing ${missing}: export certificate input error`,
        async () => {
          const args = [
            'sign-certificate',
            ...files.flatMap((file) => [
              `--${file}`,
              join(dir, file === missing ? 'absent' : file),
            ]),
          ];
          const result = await run(args);
          assert.equal(result.code, 1);
          const span = commandSpan(result, 'SignCertificate', 2);
          assert.ok(span.status.message.includes('ENOENT'));
          assert.ok(
            !JSON.stringify(received).includes('public test input'),
            'Do not export certificate or key contents',
          );
        },
      );
    }
    await t.test(
      'successful certificate input retains size attributes without contents',
      async () => {
        const result = await run([
          'sign-certificate',
          ...files.flatMap((file) => [`--${file}`, join(dir, file)]),
        ]);
        assert.equal(result.code, 0);
        const span = commandSpan(result, 'SignCertificate', 1);
        for (const key of [
          'crypto.csr_size',
          'crypto.ca_cert_size',
          'crypto.ca_key_size',
        ]) {
          assert.equal(
            Number(
              span.attributes.find((attribute) => attribute.key === key)?.value
                .intValue,
            ),
            'public test input'.length,
          );
        }
        assert.ok(!JSON.stringify(received).includes('public test input'));
        assert.ok(result.stdout.includes('test-certificate'));
      },
    );
    await t.test(
      'SIGTERM aborts local benchmark and exports its active command',
      async () => {
        const result = await run(
          [
            'local-benchmark',
            '--hashData-data',
            'test',
            ...files.flatMap((file) => [
              `--signCertificate-${file}`,
              join(dir, file),
            ]),
          ],
          { signal: 'SIGTERM' },
        );
        assert.equal(result.code, 0);
        commandSpan(result, 'HashData', 1);
        assert.equal(result.requests, 1);
      },
    );
    await t.test(
      'disabled telemetry preserves the command output',
      async () => {
        const result = await run(['hash-data', 'test'], {
          traces: 'none',
          logs: 'none',
        });
        assert.equal(result.code, 0);
        assert.ok(result.stdout.includes('test-hash'));
        assert.equal(result.spans.length, 0);
        assert.equal(result.records.length, 0);
      },
    );
  },
);

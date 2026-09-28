import assert from 'node:assert/strict';
import test from 'node:test';

import { Metadata } from '@grpc/grpc-js';
import { context, trace } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

import { grpcTraceContextInterceptor } from '../dist/otel/grpcTraceContext.js';

test('injects the active W3C trace context into gRPC metadata', async () => {
  const provider = new NodeTracerProvider();
  provider.register();
  const span = provider
    .getTracer('grpc-trace-context-test')
    .startSpan('parent');
  let sentMetadata;

  const nextCall = () => ({
    start(metadata) {
      sentMetadata = metadata;
    },
    sendMessage() {},
    startRead() {},
    halfClose() {},
    cancelWithStatus() {},
    getPeer() {
      return 'test';
    },
    getAuthContext() {
      return null;
    },
  });

  context.with(trace.setSpan(context.active(), span), () => {
    const call = grpcTraceContextInterceptor({}, nextCall);
    call.start(new Metadata());
  });

  assert.equal(
    sentMetadata.get('traceparent')[0],
    `00-${span.spanContext().traceId}-${span.spanContext().spanId}-01`,
  );
  span.end();
  await provider.shutdown();
});

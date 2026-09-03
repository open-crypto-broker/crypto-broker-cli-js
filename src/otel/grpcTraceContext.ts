import { InterceptingCall } from '@grpc/grpc-js';
import type { Interceptor, Metadata } from '@grpc/grpc-js';
import { context, propagation } from '@opentelemetry/api';

const grpcMetadataSetter = {
  set(carrier: Metadata, key: string, value: string) {
    carrier.set(key, value);
  },
};

export const grpcTraceContextInterceptor: Interceptor = (options, nextCall) =>
  new InterceptingCall(nextCall(options), {
    start(metadata, listener, next) {
      propagation.inject(context.active(), metadata, grpcMetadataSetter);
      next(metadata, listener);
    },
  });

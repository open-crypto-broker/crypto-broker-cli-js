import { InterceptingCall } from '@grpc/grpc-js';
import { context, propagation } from '@opentelemetry/api';
const grpcMetadataSetter = {
    set(carrier, key, value) {
        carrier.set(key, value);
    },
};
export const grpcTraceContextInterceptor = (options, nextCall) => new InterceptingCall(nextCall(options), {
    start(metadata, listener, next) {
        propagation.inject(context.active(), metadata, grpcMetadataSetter);
        next(metadata, listener);
    },
});
//# sourceMappingURL=grpcTraceContext.js.map
import { diag, DiagConsoleLogger, DiagLogLevel, trace } from '@opentelemetry/api';
let initialized = false;
export function bootstrapOpenTelemetry(serviceName) {
    if (initialized) {
        return;
    }
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);
    const tracer = trace.getTracer(serviceName);
    tracer.startActiveSpan('gateway.bootstrap', (span) => {
        span.setAttribute('service.name', serviceName);
        span.end();
    });
    initialized = true;
}

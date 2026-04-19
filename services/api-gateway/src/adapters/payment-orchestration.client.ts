import type { DownstreamClientConfig, DownstreamTransport } from './downstream-client.types.js';
import { ServiceClient } from './service-client.base.js';

export function buildPaymentOrchestrationClient(transport: DownstreamTransport): ServiceClient {
  const config: DownstreamClientConfig = {
    serviceName: 'payment-orchestration',
    baseUrl: process.env.PAYMENT_ORCHESTRATION_URL ?? 'http://localhost:3004',
    retryPolicy: { maxAttempts: 2 },
    timeoutPolicy: { requestTimeoutMs: 1500 }
  };

  return new ServiceClient(config, transport);
}

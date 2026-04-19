import type { DownstreamClientConfig, DownstreamTransport } from './downstream-client.types.js';
import { ServiceClient } from './service-client.base.js';

export function buildEkycOrchestrationClient(transport: DownstreamTransport): ServiceClient {
  const config: DownstreamClientConfig = {
    serviceName: 'ekyc-orchestration',
    baseUrl: process.env.EKYC_ORCHESTRATION_URL ?? 'http://localhost:3005',
    retryPolicy: { maxAttempts: 2 },
    timeoutPolicy: { requestTimeoutMs: 1500 }
  };

  return new ServiceClient(config, transport);
}

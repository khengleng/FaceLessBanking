import type { DownstreamClientConfig, DownstreamTransport } from './downstream-client.types.js';
import { ServiceClient } from './service-client.base.js';

export function buildAccountServiceClient(transport: DownstreamTransport): ServiceClient {
  const config: DownstreamClientConfig = {
    serviceName: 'account-service',
    baseUrl: process.env.ACCOUNT_SERVICE_URL ?? 'http://localhost:3002',
    retryPolicy: { maxAttempts: 2 },
    timeoutPolicy: { requestTimeoutMs: 1500 }
  };

  return new ServiceClient(config, transport);
}

import type { DownstreamClientConfig, DownstreamTransport } from './downstream-client.types.js';
import { ServiceClient } from './service-client.base.js';

export function buildCustomerServiceClient(transport: DownstreamTransport): ServiceClient {
  const config: DownstreamClientConfig = {
    serviceName: 'customer-service',
    baseUrl: process.env.CUSTOMER_SERVICE_URL ?? 'http://localhost:3001',
    retryPolicy: { maxAttempts: 2 },
    timeoutPolicy: { requestTimeoutMs: 1500 }
  };

  return new ServiceClient(config, transport);
}

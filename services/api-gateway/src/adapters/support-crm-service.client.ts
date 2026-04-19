import type { DownstreamClientConfig, DownstreamTransport } from './downstream-client.types.js';
import { ServiceClient } from './service-client.base.js';

export function buildSupportCrmServiceClient(transport: DownstreamTransport): ServiceClient {
  const config: DownstreamClientConfig = {
    serviceName: 'support-crm-service',
    baseUrl: process.env.SUPPORT_CRM_SERVICE_URL ?? 'http://localhost:3006',
    retryPolicy: { maxAttempts: 2 },
    timeoutPolicy: { requestTimeoutMs: 1500 }
  };

  return new ServiceClient(config, transport);
}

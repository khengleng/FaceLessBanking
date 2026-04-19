import type { GatewayRoute } from '../application/gateway.application.js';

import { buildAccountServiceClient } from './account-service.client.js';
import { buildCustomerServiceClient } from './customer-service.client.js';
import { buildEkycOrchestrationClient } from './ekyc-orchestration.client.js';
import { buildLoanOrchestrationClient } from './loan-orchestration.client.js';
import type { DownstreamRequest, DownstreamResult } from './downstream-client.types.js';
import { PlaceholderDownstreamTransport } from './downstream-http.adapter.js';
import { buildPaymentOrchestrationClient } from './payment-orchestration.client.js';
import { buildSupportCrmServiceClient } from './support-crm-service.client.js';
import type { ServiceClient } from './service-client.base.js';

export type DownstreamPlaceholderResponse = Record<string, unknown>;

export class BackendServicesAdapter {
  private readonly clientsByRoute: Record<GatewayRoute, ServiceClient>;

  constructor() {
    const transport = new PlaceholderDownstreamTransport();

    this.clientsByRoute = {
      customers: buildCustomerServiceClient(transport),
      accounts: buildAccountServiceClient(transport),
      loans: buildLoanOrchestrationClient(transport),
      payments: buildPaymentOrchestrationClient(transport),
      ekyc: buildEkycOrchestrationClient(transport),
      support: buildSupportCrmServiceClient(transport)
    };
  }

  async forwardToService(request: DownstreamRequest): Promise<DownstreamResult> {
    const client = this.clientsByRoute[request.route];

    try {
      return await client.call(request);
    } catch {
      return {
        statusCode: 502,
        data: {
          error: 'downstream_unavailable',
          details: ['Downstream service call failed in gateway adapter'],
          route: request.route
        }
      };
    }
  }
}

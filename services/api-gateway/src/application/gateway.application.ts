import {
  BackendServicesAdapter,
  type DownstreamPlaceholderResponse
} from '../adapters/backend-services.adapter.js';
import type { DownstreamRequest } from '../adapters/downstream-client.types.js';

export const gatewayRoutes = [
  'customers',
  'accounts',
  'loans',
  'payments',
  'ekyc',
  'support'
] as const;

export type GatewayRoute = (typeof gatewayRoutes)[number];

export function isGatewayRoute(value: string): value is GatewayRoute {
  return gatewayRoutes.includes(value as GatewayRoute);
}

export type GatewayRouteResponse = {
  statusCode: number;
  correlationId: string;
  data: DownstreamPlaceholderResponse;
};

export class GatewayApplication {
  constructor(private readonly adapter: BackendServicesAdapter) {}

  async routeRequest(request: DownstreamRequest): Promise<GatewayRouteResponse> {
    const result = await this.adapter.forwardToService(request);

    return {
      statusCode: result.statusCode,
      correlationId: request.correlationId,
      data: result.data
    };
  }
}

export function buildGatewayApplication(): GatewayApplication {
  return new GatewayApplication(new BackendServicesAdapter());
}

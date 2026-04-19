import { BackendServicesAdapter } from '../adapters/backend-services.adapter.js';
export const gatewayRoutes = [
    'customers',
    'accounts',
    'loans',
    'payments',
    'ekyc',
    'support'
];
export class GatewayApplication {
    adapter;
    constructor(adapter) {
        this.adapter = adapter;
    }
    async routeRequest(route, correlationId) {
        const data = await this.adapter.forwardToService(route);
        return {
            statusCode: 501,
            correlationId,
            data
        };
    }
}
export function buildGatewayApplication() {
    return new GatewayApplication(new BackendServicesAdapter());
}

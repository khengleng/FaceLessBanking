import type { InMemoryErrorLogAdapter } from '../adapters/error-log.adapter.js';

export type ServiceVisibility = {
  serviceName: string;
  status: 'UP' | 'DOWN';
  endpoints: string[];
  updatedAt: string;
};

export class AdminApplication {
  private readonly serviceStartTime = Date.now();

  constructor(private readonly errorLogAdapter: InMemoryErrorLogAdapter) {}

  async getSystemHealth(): Promise<{
    status: 'OK';
    uptimeSeconds: number;
    timestamp: string;
  }> {
    return {
      status: 'OK',
      uptimeSeconds: Math.max(0, Math.floor((Date.now() - this.serviceStartTime) / 1000)),
      timestamp: new Date().toISOString()
    };
  }

  async getServices(): Promise<ServiceVisibility[]> {
    const now = new Date().toISOString();

    return [
      {
        serviceName: 'config-service',
        status: 'UP',
        endpoints: [
          '/health',
          '/config',
          '/features/:flagKey',
          '/admin/system-health',
          '/admin/services',
          '/admin/errors'
        ],
        updatedAt: now
      }
    ];
  }

  async getErrors(): Promise<{
    items: Array<{
      errorId: string;
      message: string;
      path: string;
      method: string;
      timestamp: string;
    }>;
  }> {
    return {
      items: await this.errorLogAdapter.listErrors()
    };
  }
}

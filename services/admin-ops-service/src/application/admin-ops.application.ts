import type { OperationalDataAdapter } from '../adapters/operational-data.adapter.js';
import type { AdminEventsAdapter } from '../events/admin-events.adapter.js';
import type { SafeErrorRecord, ServiceVisibility, SystemHealth } from '../domain/admin-ops.js';

export class AdminOpsApplication {
  constructor(
    private readonly operationalData: OperationalDataAdapter,
    private readonly events: AdminEventsAdapter
  ) {}

  async getSystemHealth(): Promise<SystemHealth> {
    const health = await this.operationalData.getSystemHealth();
    await this.events.emitAdminViewAccessed('system-health');
    return health;
  }

  async getServices(): Promise<ServiceVisibility[]> {
    const services = await this.operationalData.getServices();
    await this.events.emitAdminViewAccessed('services');
    return services;
  }

  async getErrors(): Promise<SafeErrorRecord[]> {
    const errors = await this.operationalData.getErrors();
    await this.events.emitAdminViewAccessed('errors');
    return errors;
  }
}

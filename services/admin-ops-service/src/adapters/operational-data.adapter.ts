import { randomUUID } from 'node:crypto';

import type {
  SafeErrorRecord,
  ServiceVisibility,
  SystemHealth
} from '../domain/admin-ops.js';

export class OperationalDataAdapter {
  private readonly startedAtMs = Date.now();

  private readonly services: ServiceVisibility[] = [
    {
      serviceName: 'api-gateway',
      status: 'UP',
      category: 'core',
      updatedAt: '2026-04-17T00:00:00.000Z'
    },
    {
      serviceName: 'customer-service',
      status: 'UP',
      category: 'core',
      updatedAt: '2026-04-17T00:01:00.000Z'
    },
    {
      serviceName: 'payment-orchestration',
      status: 'UP',
      category: 'orchestration',
      updatedAt: '2026-04-17T00:02:00.000Z'
    },
    {
      serviceName: 'workflow-case-management',
      status: 'UP',
      category: 'ops',
      updatedAt: '2026-04-17T00:03:00.000Z'
    }
  ];

  private readonly errors: SafeErrorRecord[] = [
    {
      errorId: randomUUID(),
      code: 'PAYMENT_TIMEOUT',
      message: 'Transient timeout while processing internal transfer',
      source: 'payment-orchestration',
      timestamp: '2026-04-17T10:00:00.000Z'
    },
    {
      errorId: randomUUID(),
      code: 'LOAN_RULE_REJECTED',
      message: 'Loan request rejected by eligibility placeholder',
      source: 'loan-orchestration',
      timestamp: '2026-04-17T10:05:00.000Z'
    }
  ];

  async getSystemHealth(): Promise<SystemHealth> {
    return {
      status: 'OK',
      uptimeSeconds: Math.max(0, Math.floor((Date.now() - this.startedAtMs) / 1000)),
      timestamp: new Date().toISOString()
    };
  }

  async getServices(): Promise<ServiceVisibility[]> {
    return this.services.map((service) => structuredClone(service));
  }

  async getErrors(): Promise<SafeErrorRecord[]> {
    return this.errors.map((error) => structuredClone(error));
  }
}

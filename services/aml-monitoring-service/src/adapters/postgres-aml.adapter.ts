import { randomUUID } from 'node:crypto';

import type { AMLAlert, AMLAlertCandidate } from '../domain/aml-alert.js';

type TransactionHistoryRecord = {
  sourceAccountId: string;
  customerId: string;
  createdAt: number;
};

export class PostgresAmlAdapter {
  private readonly alerts = new Map<string, AMLAlert>();

  private readonly processedAmlEvents = new Set<string>();

  private readonly transactionHistory: TransactionHistoryRecord[] = [];

  async createAmlAlert(candidate: AMLAlertCandidate): Promise<AMLAlert> {
    const alert: AMLAlert = {
      alertId: randomUUID(),
      sourceEventId: candidate.sourceEventId,
      entityType: candidate.entityType,
      entityId: candidate.entityId,
      ruleName: candidate.ruleName,
      severity: candidate.severity,
      status: 'OPEN',
      reason: candidate.reason,
      createdAt: new Date().toISOString()
    };

    this.alerts.set(alert.alertId, alert);
    return structuredClone(alert);
  }

  async getAmlAlertById(alertId: string): Promise<AMLAlert | null> {
    const alert = this.alerts.get(alertId);
    return alert ? structuredClone(alert) : null;
  }

  async listAmlAlerts(): Promise<AMLAlert[]> {
    return Array.from(this.alerts.values())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((alert) => structuredClone(alert));
  }

  async hasProcessedAmlEvent(eventId: string): Promise<boolean> {
    return this.processedAmlEvents.has(eventId);
  }

  async markAmlEventProcessed(eventId: string): Promise<void> {
    this.processedAmlEvents.add(eventId);
  }

  async recordTransactionAndGetRecentCount(input: {
    sourceAccountId: string;
    customerId: string;
    windowMs: number;
  }): Promise<number> {
    const now = Date.now();
    this.transactionHistory.push({
      sourceAccountId: input.sourceAccountId,
      customerId: input.customerId,
      createdAt: now
    });

    const windowStart = now - input.windowMs;
    return this.transactionHistory.filter((record) => (
      record.createdAt >= windowStart
      && (
        record.sourceAccountId === input.sourceAccountId
        || record.customerId === input.customerId
      )
    )).length;
  }
}

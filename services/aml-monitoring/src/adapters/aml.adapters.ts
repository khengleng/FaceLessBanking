import crypto from 'node:crypto';

import type { EventEnvelope } from '@faceless-banking/shared-events';

import type { AMLAlert, TransactionSignal } from '../domain/aml.js';

export interface AMLStoreAdapter {
  createAlert(input: Omit<AMLAlert, 'alertId' | 'status' | 'createdAt'>): Promise<AMLAlert>;
  listAlerts(): Promise<AMLAlert[]>;
  hasProcessedEvent(eventId: string): Promise<boolean>;
  markProcessedEvent(eventId: string): Promise<void>;
  getHistoricalAverageAmount(accountId: string): Promise<number>;
  recordTransaction(signal: TransactionSignal): Promise<void>;
}

export interface AMLEventAdapter {
  publishAlert(event: EventEnvelope<'aml.alert.v1', Record<string, unknown>>): Promise<void>;
}

export class InMemoryAMLStoreAdapter implements AMLStoreAdapter {
  private readonly alerts: AMLAlert[] = [];

  private readonly processedEvents = new Set<string>();

  private readonly transactionsByAccount = new Map<string, number[]>();

  async createAlert(input: Omit<AMLAlert, 'alertId' | 'status' | 'createdAt'>): Promise<AMLAlert> {
    const alert: AMLAlert = {
      alertId: crypto.randomUUID(),
      accountId: input.accountId,
      transactionId: input.transactionId,
      reason: input.reason,
      amount: input.amount,
      status: 'OPEN',
      createdAt: new Date().toISOString()
    };

    this.alerts.push(alert);
    return alert;
  }

  async listAlerts(): Promise<AMLAlert[]> {
    return [...this.alerts].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async hasProcessedEvent(eventId: string): Promise<boolean> {
    return this.processedEvents.has(eventId);
  }

  async markProcessedEvent(eventId: string): Promise<void> {
    this.processedEvents.add(eventId);
  }

  async getHistoricalAverageAmount(accountId: string): Promise<number> {
    const txs = this.transactionsByAccount.get(accountId) ?? [];
    if (txs.length === 0) {
      return 0;
    }

    return txs.reduce((sum, value) => sum + value, 0) / txs.length;
  }

  async recordTransaction(signal: TransactionSignal): Promise<void> {
    const existing = this.transactionsByAccount.get(signal.accountId) ?? [];
    existing.push(signal.amount);
    this.transactionsByAccount.set(signal.accountId, existing);
  }
}

export class InMemoryAMLEventAdapter implements AMLEventAdapter {
  readonly publishedEvents: EventEnvelope<'aml.alert.v1', Record<string, unknown>>[] = [];

  async publishAlert(event: EventEnvelope<'aml.alert.v1', Record<string, unknown>>): Promise<void> {
    this.publishedEvents.push(event);
  }
}

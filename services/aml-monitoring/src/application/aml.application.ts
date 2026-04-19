import crypto from 'node:crypto';

import { buildEventEnvelope } from '@faceless-banking/shared-events';

import type { AMLEventAdapter, AMLStoreAdapter } from '../adapters/aml.adapters.js';
import {
  isLargeTransaction,
  isUnusualPattern,
  type AMLAlert,
  type TransactionSignal
} from '../domain/aml.js';

type Logger = {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
};

export class AMLApplication {
  constructor(
    private readonly store: AMLStoreAdapter,
    private readonly events: AMLEventAdapter,
    private readonly logger: Logger
  ) {}

  async listAlerts(): Promise<AMLAlert[]> {
    return this.store.listAlerts();
  }

  async processTransaction(signal: TransactionSignal): Promise<{ flagged: boolean; alert?: AMLAlert }> {
    if (await this.store.hasProcessedEvent(signal.eventId)) {
      this.logger.info({ eventId: signal.eventId }, 'Duplicate AML signal skipped');
      return { flagged: false };
    }

    const historicalAverage = await this.store.getHistoricalAverageAmount(signal.accountId);
    const large = isLargeTransaction(signal.amount);
    const unusual = isUnusualPattern(signal.amount, historicalAverage);

    await this.store.recordTransaction(signal);
    await this.store.markProcessedEvent(signal.eventId);

    if (!large && !unusual) {
      return { flagged: false };
    }

    const reason = large && unusual
      ? 'LARGE_TRANSACTION_AND_UNUSUAL_PATTERN'
      : large
        ? 'LARGE_TRANSACTION'
        : 'UNUSUAL_PATTERN';

    const alert = await this.store.createAlert({
      accountId: signal.accountId,
      transactionId: signal.transactionId,
      reason,
      amount: signal.amount
    });

    await this.events.publishAlert(
      buildEventEnvelope({
        type: 'aml.alert.v1',
        version: 1,
        metadata: {
          eventId: crypto.randomUUID(),
          correlationId: signal.correlationId,
          causationId: signal.eventId,
          timestamp: new Date().toISOString(),
          producer: 'aml-monitoring'
        },
        payload: {
          alertId: alert.alertId,
          accountId: alert.accountId,
          transactionId: alert.transactionId,
          reason: alert.reason,
          amount: alert.amount,
          status: alert.status,
          createdAt: alert.createdAt
        }
      })
    );

    this.logger.warn(
      { alertId: alert.alertId, reason: alert.reason, transactionId: alert.transactionId },
      'Suspicious transaction flagged'
    );

    return { flagged: true, alert };
  }
}

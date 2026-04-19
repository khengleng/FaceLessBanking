import { randomUUID } from 'node:crypto';

import type { PostgresAccountAdapter } from '../adapters/postgres-account.adapter.js';
import { buildAccount, type Account } from '../domain/account.js';
import type { AccountEventsPublisher } from '../events/account.events.js';
import type { AuditEventsService } from '../events/audit.events.js';
import type { CustomerAccountCreationMetrics } from '../events/metrics.js';

type CustomerCreatedEvent = {
  specVersion: '1.0';
  type: 'customer.created.v1';
  version: number;
  metadata: {
    eventId: string;
    correlationId: string;
    timestamp: string;
    producer: string;
    causationId?: string;
  };
  payload: {
    customerId: string;
    onboardingReference?: string;
    sourceEventId?: string;
    status?: string;
  };
};

export type ProcessCustomerCreatedResult =
  | { kind: 'created'; account: Account }
  | { kind: 'duplicate_event' }
  | { kind: 'already_exists'; accountId: string }
  | { kind: 'invalid_event'; reason: string };

export class CustomerAccountCreationApplication {
  constructor(
    private readonly postgresAdapter: PostgresAccountAdapter,
    private readonly accountEvents: AccountEventsPublisher,
    private readonly auditEvents: AuditEventsService,
    private readonly metrics: CustomerAccountCreationMetrics,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  async processCustomerCreated(rawEvent: unknown): Promise<ProcessCustomerCreatedResult> {
    const event = parseCustomerCreatedEvent(rawEvent);
    if (!event) {
      return { kind: 'invalid_event', reason: 'invalid_customer_created_event' };
    }

    const alreadyProcessed = await this.postgresAdapter.hasProcessedAccountCreationEvent(event.metadata.eventId);
    if (alreadyProcessed) {
      this.metrics.recordDuplicateAccountCreationEventSkipped();
      return { kind: 'duplicate_event' };
    }

    const existing = await this.postgresAdapter.findAccountByCustomerId(event.payload.customerId);
    if (existing) {
      await this.postgresAdapter.markAccountCreationEventProcessed(event.metadata.eventId);
      this.metrics.recordExistingAccountSkip();
      this.logger.info(
        {
          sourceEventId: event.metadata.eventId,
          correlationId: event.metadata.correlationId,
          customerId: event.payload.customerId,
          accountId: existing.accountId
        },
        'Skipping account creation because account already exists for customer'
      );
      return { kind: 'already_exists', accountId: existing.accountId };
    }

    const now = new Date().toISOString();
    const account = buildAccount({
      accountId: randomUUID(),
      customerId: event.payload.customerId,
      onboardingReference: event.payload.onboardingReference,
      sourceEventId: event.metadata.eventId,
      accountType: 'SAVINGS',
      productCode: 'SAVINGS',
      currency: 'USD',
      status: 'PENDING_ACTIVATION',
      createdAt: now,
      updatedAt: now,
      externalAccountId: `internal-${event.payload.customerId}`,
      openingBalanceCents: 0
    });

    await this.postgresAdapter.createAccount(account);
    await this.postgresAdapter.markAccountCreationEventProcessed(event.metadata.eventId);
    await this.auditEvents.createAccountFromCustomerAuditRecord({
      accountId: account.accountId,
      customerId: account.customerId,
      sourceEventId: event.metadata.eventId,
      correlationId: event.metadata.correlationId
    });
    await this.accountEvents.emitAccountCreatedFromCustomer({
      account,
      correlationId: event.metadata.correlationId,
      sourceEventId: event.metadata.eventId
    });

    this.metrics.recordAccountCreatedFromCustomerEvent();
    this.logger.info(
      {
        sourceEventId: event.metadata.eventId,
        correlationId: event.metadata.correlationId,
        customerId: event.payload.customerId,
        accountId: account.accountId
      },
      'Created account from customer.created.v1 event'
    );

    return { kind: 'created', account };
  }
}

function parseCustomerCreatedEvent(rawEvent: unknown): CustomerCreatedEvent | null {
  if (!rawEvent || typeof rawEvent !== 'object') {
    return null;
  }

  const event = rawEvent as Record<string, unknown>;
  if (event.specVersion !== '1.0' || event.type !== 'customer.created.v1' || typeof event.version !== 'number') {
    return null;
  }

  const metadata = event.metadata as Record<string, unknown> | undefined;
  const payload = event.payload as Record<string, unknown> | undefined;
  if (!metadata || !payload) {
    return null;
  }

  if (
    typeof metadata.eventId !== 'string'
    || typeof metadata.correlationId !== 'string'
    || typeof metadata.timestamp !== 'string'
    || typeof metadata.producer !== 'string'
  ) {
    return null;
  }

  if (typeof payload.customerId !== 'string') {
    return null;
  }

  if (payload.onboardingReference !== undefined && typeof payload.onboardingReference !== 'string') {
    return null;
  }

  if (payload.sourceEventId !== undefined && typeof payload.sourceEventId !== 'string') {
    return null;
  }

  if (payload.status !== undefined && typeof payload.status !== 'string') {
    return null;
  }

  return event as CustomerCreatedEvent;
}

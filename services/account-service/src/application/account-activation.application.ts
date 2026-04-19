import type { PostgresAccountAdapter } from '../adapters/postgres-account.adapter.js';
import type { RedisIdempotencyAdapter } from '../adapters/redis-idempotency.adapter.js';
import { canActivateAccount } from '../domain/account.js';
import type { Account } from '../domain/account.js';
import type { AccountEventsPublisher } from '../events/account.events.js';
import type { AuditEventsService } from '../events/audit.events.js';
import type { AccountActivationMetrics } from '../events/metrics.js';

type AccountCreatedEvent = {
  specVersion: '1.0';
  type: 'account.created.v1';
  version: number;
  metadata: {
    eventId: string;
    correlationId: string;
    timestamp: string;
    producer: string;
    causationId?: string;
  };
  payload: {
    accountId: string;
    customerId: string;
    status?: string;
  };
};

export type ManualActivationResult =
  | { kind: 'activated'; account: Account; oldStatus: Account['status'] }
  | { kind: 'already_active'; account: Account }
  | { kind: 'duplicate_idempotency'; account: Account }
  | { kind: 'invalid_transition'; account: Account; reason: string }
  | { kind: 'account_not_found' }
  | { kind: 'idempotency_key_required' };

export type ProcessAccountCreatedActivationResult =
  | { kind: 'activated'; account: Account; oldStatus: Account['status'] }
  | { kind: 'already_active'; account: Account }
  | { kind: 'duplicate_event' }
  | { kind: 'invalid_event'; reason: string }
  | { kind: 'account_not_found' }
  | { kind: 'invalid_transition'; account: Account; reason: string };

export class AccountActivationApplication {
  constructor(
    private readonly postgresAdapter: PostgresAccountAdapter,
    private readonly redisAdapter: RedisIdempotencyAdapter,
    private readonly accountEvents: AccountEventsPublisher,
    private readonly auditEvents: AuditEventsService,
    private readonly metrics: AccountActivationMetrics,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  async activateAccountManually(input: {
    accountId: string;
    idempotencyKey: string | undefined;
    correlationId: string;
  }): Promise<ManualActivationResult> {
    if (!input.idempotencyKey) {
      return { kind: 'idempotency_key_required' };
    }

    const idempotencyStorageKey = this.manualActivationIdempotencyKey(input.idempotencyKey);
    const existingAccountId = await this.redisAdapter.getAccountIdByKey(idempotencyStorageKey);
    if (existingAccountId) {
      const existingAccount = await this.postgresAdapter.getAccountById(existingAccountId);
      if (existingAccount) {
        this.metrics.recordDuplicateActivationSkipped();
        return { kind: 'duplicate_idempotency', account: existingAccount };
      }
    }

    const account = await this.postgresAdapter.getAccountById(input.accountId);
    if (!account) {
      return { kind: 'account_not_found' };
    }

    if (account.status === 'ACTIVE') {
      this.metrics.recordDuplicateActivationSkipped();
      await this.redisAdapter.saveKey(idempotencyStorageKey, account.accountId);
      return { kind: 'already_active', account };
    }

    if (!canActivateAccount(account.status)) {
      this.metrics.recordInvalidActivationAttemptBlocked();
      return {
        kind: 'invalid_transition',
        account,
        reason: `Cannot activate account from status ${account.status}`
      };
    }

    const oldStatus = account.status;
    await this.postgresAdapter.updateAccountStatus(account.accountId, 'ACTIVE');
    const activated = await this.postgresAdapter.getAccountById(account.accountId) ?? {
      ...account,
      status: 'ACTIVE' as const,
      updatedAt: new Date().toISOString()
    };

    await this.auditEvents.createAccountActivatedAuditRecord({
      accountId: activated.accountId,
      idempotencyKey: input.idempotencyKey
    });
    await this.accountEvents.emitAccountActivated({
      account: activated,
      oldStatus,
      correlationId: input.correlationId
    });
    await this.redisAdapter.saveKey(idempotencyStorageKey, activated.accountId);

    this.metrics.recordAccountActivated();
    this.logger.info({
      correlationId: input.correlationId,
      accountId: activated.accountId,
      oldStatus,
      newStatus: activated.status
    }, 'Activated account via manual activation endpoint');

    return { kind: 'activated', account: activated, oldStatus };
  }

  async processAccountCreated(rawEvent: unknown): Promise<ProcessAccountCreatedActivationResult> {
    const event = parseAccountCreatedEvent(rawEvent);
    if (!event) {
      return { kind: 'invalid_event', reason: 'invalid_account_created_event' };
    }

    const alreadyProcessed = await this.postgresAdapter.hasProcessedActivationEvent(event.metadata.eventId);
    if (alreadyProcessed) {
      this.metrics.recordDuplicateActivationSkipped();
      return { kind: 'duplicate_event' };
    }

    const account = await this.postgresAdapter.getAccountById(event.payload.accountId);
    if (!account) {
      this.logger.warn({
        sourceEventId: event.metadata.eventId,
        accountId: event.payload.accountId
      }, 'Received account.created.v1 for missing account');
      return { kind: 'account_not_found' };
    }

    if (account.status === 'ACTIVE') {
      await this.postgresAdapter.markActivationEventProcessed(event.metadata.eventId);
      this.metrics.recordDuplicateActivationSkipped();
      return { kind: 'already_active', account };
    }

    if (!canActivateAccount(account.status)) {
      this.metrics.recordInvalidActivationAttemptBlocked();
      return {
        kind: 'invalid_transition',
        account,
        reason: `Cannot activate account from status ${account.status}`
      };
    }

    const oldStatus = account.status;
    await this.postgresAdapter.updateAccountStatus(account.accountId, 'ACTIVE');
    const activated = await this.postgresAdapter.getAccountById(account.accountId) ?? {
      ...account,
      status: 'ACTIVE' as const,
      updatedAt: new Date().toISOString()
    };
    await this.postgresAdapter.markActivationEventProcessed(event.metadata.eventId);
    await this.auditEvents.createAccountActivatedAuditRecord({
      accountId: activated.accountId,
      idempotencyKey: event.metadata.eventId
    });
    await this.accountEvents.emitAccountActivated({
      account: activated,
      oldStatus,
      correlationId: event.metadata.correlationId,
      sourceEventId: event.metadata.eventId
    });

    this.metrics.recordAccountActivated();
    this.logger.info({
      sourceEventId: event.metadata.eventId,
      correlationId: event.metadata.correlationId,
      accountId: activated.accountId,
      oldStatus,
      newStatus: activated.status
    }, 'Activated account from account.created.v1 event');

    return { kind: 'activated', account: activated, oldStatus };
  }

  private manualActivationIdempotencyKey(idempotencyKey: string): string {
    return `account-activation:${idempotencyKey}`;
  }
}

function parseAccountCreatedEvent(rawEvent: unknown): AccountCreatedEvent | null {
  if (!rawEvent || typeof rawEvent !== 'object') {
    return null;
  }

  const event = rawEvent as Record<string, unknown>;
  if (event.specVersion !== '1.0' || event.type !== 'account.created.v1' || typeof event.version !== 'number') {
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

  if (typeof payload.accountId !== 'string' || typeof payload.customerId !== 'string') {
    return null;
  }

  if (payload.status !== undefined && typeof payload.status !== 'string') {
    return null;
  }

  return event as AccountCreatedEvent;
}

import { randomUUID } from 'node:crypto';

import type { CreateAccountRequestDto, ListAccountsQueryDto } from '../controllers/dtos/account.dto.js';
import { buildAccount, type Account } from '../domain/account.js';
import type { PostgresAccountAdapter } from '../adapters/postgres-account.adapter.js';
import type { RedisIdempotencyAdapter } from '../adapters/redis-idempotency.adapter.js';
import type { FineractAdapter } from '../adapters/fineract.adapter.js';
import type { AuditEventsService } from '../events/audit.events.js';
import type { AccountEventsPublisher } from '../events/account.events.js';
import type { AccountOpsQueryMetrics } from '../events/metrics.js';

export type CreateAccountResult =
  | { kind: 'created'; account: Account }
  | { kind: 'invalid_payload'; errors: string[] }
  | { kind: 'idempotency_key_required' }
  | { kind: 'duplicate_idempotency'; accountId: string };

export type GetAccountResult =
  | { kind: 'found'; account: Account }
  | { kind: 'not_found' };

export type ListAccountsResult =
  | { kind: 'listed'; accounts: Account[] }
  | { kind: 'invalid_query'; errors: string[] };

export class AccountApplication {
  constructor(
    private readonly postgresAdapter: PostgresAccountAdapter,
    private readonly redisAdapter: RedisIdempotencyAdapter,
    private readonly fineractAdapter: FineractAdapter,
    private readonly auditEvents: AuditEventsService,
    private readonly accountEvents: AccountEventsPublisher,
    private readonly metrics: AccountOpsQueryMetrics
  ) {}

  async createAccount(
    payload: CreateAccountRequestDto,
    idempotencyKey: string | undefined
  ): Promise<CreateAccountResult> {
    if (!idempotencyKey) {
      return { kind: 'idempotency_key_required' };
    }

    const existingAccountId = await this.redisAdapter.getAccountIdByKey(idempotencyKey);
    if (existingAccountId) {
      return { kind: 'duplicate_idempotency', accountId: existingAccountId };
    }

    const errors = validateCreateAccountPayload(payload);
    if (errors.length > 0) {
      return { kind: 'invalid_payload', errors };
    }

    const fineract = await this.fineractAdapter.createAccount({
      customerId: payload.customerId,
      productCode: payload.productCode,
      currency: payload.currency,
      initialDepositCents: payload.initialDepositCents ?? 0
    });

    const account = buildAccount({
      accountId: randomUUID(),
      customerId: payload.customerId,
      productCode: payload.productCode,
      currency: payload.currency,
      status: 'PENDING_ACTIVATION',
      createdAt: new Date().toISOString(),
      externalAccountId: fineract.externalAccountId,
      openingBalanceCents: fineract.openingBalanceCents
    });

    await this.postgresAdapter.insertAccount(account);
    await this.redisAdapter.saveKey(idempotencyKey, account.accountId);
    await this.auditEvents.createAccountAuditRecord(account.accountId, idempotencyKey);
    await this.accountEvents.emitAccountCreated(account);

    return { kind: 'created', account };
  }

  async getAccountById(accountId: string): Promise<GetAccountResult> {
    const account = await this.postgresAdapter.findAccountById(accountId);
    this.metrics.recordDetailQuery();

    if (!account) {
      return { kind: 'not_found' };
    }

    return { kind: 'found', account };
  }

  async getAccountBalance(accountId: string): Promise<GetAccountResult> {
    return this.getAccountById(accountId);
  }

  async listAccounts(query: ListAccountsQueryDto): Promise<ListAccountsResult> {
    const errors = validateListAccountsQuery(query);
    if (errors.length > 0) {
      return { kind: 'invalid_query', errors };
    }

    const accounts = await this.postgresAdapter.listAccounts({
      customerId: query.customerId,
      accountId: query.accountId,
      onboardingReference: query.onboardingReference,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0
    });
    this.metrics.recordListQuery();
    if (query.customerId || query.accountId || query.onboardingReference) {
      this.metrics.recordFilteredQueryUsage();
    }

    return { kind: 'listed', accounts };
  }
}

function validateCreateAccountPayload(payload: CreateAccountRequestDto): string[] {
  const errors: string[] = [];

  if (!payload.customerId || payload.customerId.trim().length < 3) {
    errors.push('customerId must contain at least 3 characters');
  }

  if (!payload.productCode || payload.productCode.trim().length < 2) {
    errors.push('productCode must contain at least 2 characters');
  }

  if (!payload.currency || payload.currency.trim().length !== 3) {
    errors.push('currency must be a 3-letter currency code');
  }

  if (payload.initialDepositCents !== undefined && payload.initialDepositCents < 0) {
    errors.push('initialDepositCents cannot be negative');
  }

  return errors;
}

function validateListAccountsQuery(query: ListAccountsQueryDto): string[] {
  const errors: string[] = [];

  if (query.customerId !== undefined && query.customerId.trim().length < 2) {
    errors.push('customerId must contain at least 2 characters when provided');
  }

  if (query.accountId !== undefined && query.accountId.trim().length < 2) {
    errors.push('accountId must contain at least 2 characters when provided');
  }

  if (query.onboardingReference !== undefined && query.onboardingReference.trim().length < 2) {
    errors.push('onboardingReference must contain at least 2 characters when provided');
  }

  if (query.limit !== undefined && (Number.isNaN(query.limit) || query.limit < 1 || query.limit > 200)) {
    errors.push('limit must be between 1 and 200');
  }

  if (query.offset !== undefined && (Number.isNaN(query.offset) || query.offset < 0)) {
    errors.push('offset must be 0 or greater');
  }

  return errors;
}

import crypto from 'node:crypto';

import type { EventEnvelope } from '@faceless-banking/shared-events';

import type { CreateLCInput, LetterOfCredit, LetterOfCreditStatus } from '../domain/lc.js';

export interface PostgresTradeFinanceAdapter {
  createLC(input: CreateLCInput): Promise<LetterOfCredit>;
  getLCById(lcId: string): Promise<LetterOfCredit | null>;
  updateLCStatus(lcId: string, status: LetterOfCreditStatus): Promise<LetterOfCredit>;
  getIdempotencyResult(scope: string, idempotencyKey: string): Promise<{ lcId: string } | null>;
  setIdempotencyResult(scope: string, idempotencyKey: string, result: { lcId: string }): Promise<void>;
}

export interface WorkflowAdapter {
  ensureApprovalAllowed(lc: LetterOfCredit): Promise<boolean>;
}

export interface AccountingAdapter {
  recordIssuance(lc: LetterOfCredit, correlationId: string): Promise<void>;
}

export interface BalanceAdapter {
  settleLC(lc: LetterOfCredit, correlationId: string): Promise<void>;
}

export interface KafkaTradeFinanceAdapter {
  publish(event: EventEnvelope<string, Record<string, unknown>>): Promise<void>;
}

export class InMemoryPostgresTradeFinanceAdapter implements PostgresTradeFinanceAdapter {
  private readonly lcById = new Map<string, LetterOfCredit>();

  private readonly idempotency = new Map<string, { lcId: string }>();

  async createLC(input: CreateLCInput): Promise<LetterOfCredit> {
    const lc: LetterOfCredit = {
      lcId: crypto.randomUUID(),
      applicant: input.applicant,
      beneficiary: input.beneficiary,
      amount: input.amount,
      currency: input.currency,
      status: 'APPLICATION',
      createdAt: new Date().toISOString()
    };

    this.lcById.set(lc.lcId, lc);
    return lc;
  }

  async getLCById(lcId: string): Promise<LetterOfCredit | null> {
    return this.lcById.get(lcId) ?? null;
  }

  async updateLCStatus(lcId: string, status: LetterOfCreditStatus): Promise<LetterOfCredit> {
    const existing = this.lcById.get(lcId);
    if (!existing) {
      throw new Error('lc_not_found');
    }

    const updated: LetterOfCredit = {
      ...existing,
      status
    };

    this.lcById.set(lcId, updated);
    return updated;
  }

  async getIdempotencyResult(scope: string, idempotencyKey: string): Promise<{ lcId: string } | null> {
    return this.idempotency.get(`${scope}:${idempotencyKey}`) ?? null;
  }

  async setIdempotencyResult(scope: string, idempotencyKey: string, result: { lcId: string }): Promise<void> {
    this.idempotency.set(`${scope}:${idempotencyKey}`, result);
  }
}

export class AllowAllWorkflowAdapter implements WorkflowAdapter {
  public checks = 0;

  async ensureApprovalAllowed(lc: LetterOfCredit): Promise<boolean> {
    void lc;
    this.checks += 1;
    return true;
  }
}

export class InMemoryAccountingAdapter implements AccountingAdapter {
  public issuedEntries: Array<{ lcId: string; correlationId: string }> = [];

  async recordIssuance(lc: LetterOfCredit, correlationId: string): Promise<void> {
    this.issuedEntries.push({ lcId: lc.lcId, correlationId });
  }
}

export class InMemoryBalanceAdapter implements BalanceAdapter {
  public settlements: Array<{ lcId: string; correlationId: string }> = [];

  async settleLC(lc: LetterOfCredit, correlationId: string): Promise<void> {
    this.settlements.push({ lcId: lc.lcId, correlationId });
  }
}

export class InMemoryKafkaTradeFinanceAdapter implements KafkaTradeFinanceAdapter {
  public readonly events: EventEnvelope<string, Record<string, unknown>>[] = [];

  async publish(event: EventEnvelope<string, Record<string, unknown>>): Promise<void> {
    this.events.push(event);
  }
}

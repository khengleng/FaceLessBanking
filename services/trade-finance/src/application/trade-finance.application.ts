import crypto from 'node:crypto';

import { buildEventEnvelope } from '@faceless-banking/shared-events';

import type {
  AccountingAdapter,
  BalanceAdapter,
  KafkaTradeFinanceAdapter,
  PostgresTradeFinanceAdapter,
  WorkflowAdapter
} from '../adapters/trade-finance.adapters.js';
import { canTransition, type CreateLCInput, type LetterOfCredit } from '../domain/lc.js';

type Logger = {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
};

export class TradeFinanceApplication {
  constructor(
    private readonly postgres: PostgresTradeFinanceAdapter,
    private readonly workflow: WorkflowAdapter,
    private readonly accounting: AccountingAdapter,
    private readonly balance: BalanceAdapter,
    private readonly kafka: KafkaTradeFinanceAdapter,
    private readonly logger: Logger
  ) {}

  async createLC(input: {
    request: CreateLCInput;
    idempotencyKey: string;
    correlationId: string;
  }): Promise<LetterOfCredit> {
    const existing = await this.postgres.getIdempotencyResult('create-lc', input.idempotencyKey);
    if (existing) {
      const lc = await this.postgres.getLCById(existing.lcId);
      if (lc) {
        this.logger.info({ lcId: lc.lcId }, 'Returning idempotent LC create result');
        return lc;
      }
    }

    const lc = await this.postgres.createLC(input.request);
    await this.postgres.setIdempotencyResult('create-lc', input.idempotencyKey, { lcId: lc.lcId });

    await this.kafka.publish(
      buildEventEnvelope({
        type: 'lc.created.v1',
        version: 1,
        metadata: {
          eventId: crypto.randomUUID(),
          correlationId: input.correlationId,
          causationId: input.idempotencyKey,
          timestamp: new Date().toISOString(),
          producer: 'trade-finance'
        },
        payload: {
          lcId: lc.lcId,
          applicant: lc.applicant,
          beneficiary: lc.beneficiary,
          amount: lc.amount,
          currency: lc.currency,
          status: lc.status
        }
      })
    );

    return lc;
  }

  async getLC(lcId: string): Promise<LetterOfCredit | null> {
    return this.postgres.getLCById(lcId);
  }

  async approveLC(input: {
    lcId: string;
    idempotencyKey: string;
    correlationId: string;
  }): Promise<LetterOfCredit> {
    return this.transitionWithIdempotency({
      scope: `approve-lc:${input.lcId}`,
      lcId: input.lcId,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      targetStatus: 'APPROVED',
      beforeTransition: async (lc) => {
        const approved = await this.workflow.ensureApprovalAllowed(lc);
        if (!approved) {
          throw new Error('workflow_approval_required');
        }
      }
    });
  }

  async issueLC(input: {
    lcId: string;
    idempotencyKey: string;
    correlationId: string;
  }): Promise<LetterOfCredit> {
    const lc = await this.transitionWithIdempotency({
      scope: `issue-lc:${input.lcId}`,
      lcId: input.lcId,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      targetStatus: 'ISSUED',
      afterTransition: async (updated) => {
        await this.accounting.recordIssuance(updated, input.correlationId);
      }
    });

    await this.kafka.publish(
      buildEventEnvelope({
        type: 'lc.issued.v1',
        version: 1,
        metadata: {
          eventId: crypto.randomUUID(),
          correlationId: input.correlationId,
          causationId: input.idempotencyKey,
          timestamp: new Date().toISOString(),
          producer: 'trade-finance'
        },
        payload: {
          lcId: lc.lcId,
          status: lc.status,
          amount: lc.amount,
          currency: lc.currency
        }
      })
    );

    return lc;
  }

  async settleLC(input: {
    lcId: string;
    idempotencyKey: string;
    correlationId: string;
  }): Promise<LetterOfCredit> {
    const lc = await this.transitionWithIdempotency({
      scope: `settle-lc:${input.lcId}`,
      lcId: input.lcId,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      targetStatus: 'SETTLED',
      afterTransition: async (updated) => {
        await this.balance.settleLC(updated, input.correlationId);
      }
    });

    await this.kafka.publish(
      buildEventEnvelope({
        type: 'lc.settled.v1',
        version: 1,
        metadata: {
          eventId: crypto.randomUUID(),
          correlationId: input.correlationId,
          causationId: input.idempotencyKey,
          timestamp: new Date().toISOString(),
          producer: 'trade-finance'
        },
        payload: {
          lcId: lc.lcId,
          status: lc.status,
          amount: lc.amount,
          currency: lc.currency
        }
      })
    );

    return lc;
  }

  private async transitionWithIdempotency(input: {
    scope: string;
    lcId: string;
    idempotencyKey: string;
    correlationId: string;
    targetStatus: 'APPROVED' | 'ISSUED' | 'SETTLED';
    beforeTransition?: (lc: LetterOfCredit) => Promise<void>;
    afterTransition?: (lc: LetterOfCredit) => Promise<void>;
  }): Promise<LetterOfCredit> {
    const existing = await this.postgres.getIdempotencyResult(input.scope, input.idempotencyKey);
    if (existing) {
      const lc = await this.postgres.getLCById(existing.lcId);
      if (lc) {
        this.logger.info({ lcId: lc.lcId, scope: input.scope }, 'Returning idempotent transition result');
        return lc;
      }
    }

    const lc = await this.postgres.getLCById(input.lcId);
    if (!lc) {
      throw new Error('lc_not_found');
    }

    if (!canTransition(lc.status, input.targetStatus)) {
      throw new Error('invalid_transition');
    }

    if (input.beforeTransition) {
      await input.beforeTransition(lc);
    }

    const updated = await this.postgres.updateLCStatus(input.lcId, input.targetStatus);

    if (input.afterTransition) {
      await input.afterTransition(updated);
    }

    await this.postgres.setIdempotencyResult(input.scope, input.idempotencyKey, { lcId: updated.lcId });

    return updated;
  }
}

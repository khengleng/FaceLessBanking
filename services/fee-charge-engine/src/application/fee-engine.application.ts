import { randomUUID } from 'node:crypto';
import type { PostgresFeeAdapter } from '../adapters/postgres-fee.adapter.js';
import type { FeeEventsPublisher } from '../events/fee-publisher.adapter.js';
import { calculateFeeCents, type FeeRule } from '../domain/fee-rule.js';
import { type FeeAssessment } from '../domain/fee-assessment.js';

interface FeeEventEnvelope {
  metadata?: {
    eventId?: string;
    correlationId?: string;
  };
  type?: string;
  payload?: {
    amountCents?: number;
    amount?: number;
    paymentId?: string;
    loanAccountId?: string;
    customerId?: string;
  };
}

export interface EvaluationResult {
  kind: 'assessed' | 'no_rule' | 'duplicate' | 'error';
  assessments?: FeeAssessment[];
  reason?: string;
}

export class FeeEngineApplication {
  constructor(
    private readonly postgresAdapter: PostgresFeeAdapter,
    private readonly feeEvents: FeeEventsPublisher,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  async evaluateEvent(eventInput: unknown): Promise<EvaluationResult> {
    const event = this.toFeeEventEnvelope(eventInput);
    if (!event) {
      return { kind: 'error', reason: 'Invalid event envelope for fee evaluation' };
    }

    const eventId = event.metadata?.eventId;
    const correlationId = event.metadata?.correlationId;
    const eventType = event.type;
    if (!eventId || !eventType) {
      return { kind: 'error', reason: 'Invalid event envelope for fee evaluation' };
    }

    const alreadyProcessed = await this.postgresAdapter.hasProcessedFeeEvent(eventId);
    if (alreadyProcessed) {
      this.logger.info({ eventId }, 'Skipping already processed fee event');
      return { kind: 'duplicate' };
    }

    const applicableRules = await this.postgresAdapter.findApplicableFeeRules(eventType);
    if (applicableRules.length === 0) {
      return { kind: 'no_rule' };
    }

    const assessments: FeeAssessment[] = [];

    for (const rule of applicableRules) {
      if (rule.status !== 'ACTIVE') continue;

      const amountCents = this.extractAmountFromEvent(event);
      const feeCents = calculateFeeCents(rule, amountCents);

      if (feeCents <= 0) continue;

      const assessment: FeeAssessment = {
        assessmentId: randomUUID(),
        sourceEventId: eventId,
        sourceEntityType: this.mapEventTypeToEntityType(eventType),
        sourceEntityId: this.extractEntityIdFromEvent(event),
        customerId: this.extractCustomerIdFromEvent(event),
        ruleId: rule.ruleId,
        assessedAmountCents: feeCents,
        currency: rule.currency,
        status: 'ASSESSED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await this.postgresAdapter.createFeeAssessment(assessment);
      await this.feeEvents.emitFeeAssessed(assessment, correlationId);
      assessments.push(assessment);
    }

    await this.postgresAdapter.markFeeEventProcessed(eventId);
    
    return { kind: 'assessed', assessments };
  }

  async createFeeRule(rule: Omit<FeeRule, 'createdAt'>): Promise<void> {
    await this.postgresAdapter.createFeeRule({
      ...rule,
      createdAt: new Date().toISOString()
    });
  }

  async getFeeRule(ruleId: string): Promise<FeeRule | null> {
    return this.postgresAdapter.getFeeRuleById(ruleId);
  }

  private extractAmountFromEvent(event: FeeEventEnvelope): number {
    // Phase 1 extraction logic
    return event.payload?.amountCents ?? event.payload?.amount ?? 0;
  }

  private extractEntityIdFromEvent(event: FeeEventEnvelope): string {
    return event.payload?.paymentId ?? event.payload?.loanAccountId ?? 'unknown';
  }

  private extractCustomerIdFromEvent(event: FeeEventEnvelope): string {
    return event.payload?.customerId ?? 'unknown-customer';
  }

  private mapEventTypeToEntityType(eventType: string): string {
    if (eventType.startsWith('payment.')) return 'PAYMENT';
    if (eventType.startsWith('loan.')) return 'LOAN';
    return 'UNKNOWN';
  }

  private toFeeEventEnvelope(input: unknown): FeeEventEnvelope | null {
    if (!input || typeof input !== 'object') {
      return null;
    }

    const candidate = input as Record<string, unknown>;
    const metadataRaw = candidate.metadata;
    const payloadRaw = candidate.payload;

    return {
      metadata: metadataRaw && typeof metadataRaw === 'object' ? (metadataRaw as FeeEventEnvelope['metadata']) : undefined,
      type: typeof candidate.type === 'string' ? candidate.type : undefined,
      payload: payloadRaw && typeof payloadRaw === 'object' ? (payloadRaw as FeeEventEnvelope['payload']) : undefined
    };
  }
}

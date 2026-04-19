import { randomUUID } from 'node:crypto';
import type { 
  LimitRule, 
  EvaluationResult, 
  LimitPeriod 
} from '../domain/limits.js';
import type { PostgresLimitsAdapter } from '../adapters/postgres-limits.adapter.js';
import type { WorkflowAdapter } from '../adapters/workflow.adapter.js';
import type { LimitsEventsPublisher } from '../events/limits-publisher.js';

export class LimitsApplication {
  constructor(
    private readonly postgresAdapter: PostgresLimitsAdapter,
    private readonly workflowAdapter: WorkflowAdapter,
    private readonly eventPublisher: LimitsEventsPublisher,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  async evaluateLimit(params: {
    entityType: 'CUSTOMER' | 'ACCOUNT';
    entityId: string;
    amountCents: bigint;
    currency: string;
    action: string;
    correlationId?: string;
  }): Promise<EvaluationResult> {
    const rules = await this.postgresAdapter.getLimitRules(params.entityType, params.entityId);
    
    // For simplicity, we filter by currency for now (could be dynamic FX later)
    const applicableRules = rules.filter(r => r.currency === params.currency);

    for (const rule of applicableRules) {
      const periodKey = this.getPeriodKey(rule.period);
      const usage = await this.postgresAdapter.getUsage(rule.ruleId, params.entityId, periodKey);
      const currentUsed = usage?.usedAmountCents ?? 0n;

      if (currentUsed + params.amountCents > rule.thresholdAmountCents) {
        if (rule.requireApproval) {
          await this.workflowAdapter.createApprovalCase({
            customerId: params.entityType === 'CUSTOMER' ? params.entityId : 'UNKNOWN',
            ruleId: rule.ruleId,
            amountCents: params.amountCents,
            currency: params.currency,
            type: 'LIMIT_OVERRIDE'
          });

          await this.eventPublisher.emitLimitDecision({
            decision: 'OVERRIDE_REQUIRED',
            entityId: params.entityId,
            amountCents: params.amountCents,
            currency: params.currency,
            ruleId: rule.ruleId,
            correlationId: params.correlationId
          });

          return { decision: 'OVERRIDE_REQUIRED', ruleId: rule.ruleId, reason: 'Approval required for limit exceed' };
        } else {
          await this.eventPublisher.emitLimitDecision({
            decision: 'BLOCKED',
            entityId: params.entityId,
            amountCents: params.amountCents,
            currency: params.currency,
            ruleId: rule.ruleId,
            correlationId: params.correlationId
          });

          return { decision: 'BLOCKED', ruleId: rule.ruleId, reason: 'Hard limit exceeded' };
        }
      }
    }

    await this.eventPublisher.emitLimitDecision({
      decision: 'ALLOWED',
      entityId: params.entityId,
      amountCents: params.amountCents,
      currency: params.currency,
      correlationId: params.correlationId
    });

    return { decision: 'ALLOWED' };
  }

  async recordUsage(params: {
    ruleId: string;
    entityId: string;
    amountCents: bigint;
  }): Promise<void> {
    const rule = await this.postgresAdapter.getRuleById(params.ruleId);
    if (!rule) return;

    const periodKey = this.getPeriodKey(rule.period);
    const usage = await this.postgresAdapter.getUsage(rule.ruleId, params.entityId, periodKey) 
      ?? {
        usageId: randomUUID(),
        ruleId: rule.ruleId,
        entityId: params.entityId,
        periodKey,
        usedAmountCents: 0n,
        updatedAt: new Date().toISOString()
      };

    usage.usedAmountCents += params.amountCents;
    await this.postgresAdapter.updateUsage(usage);
  }

  private getPeriodKey(period: LimitPeriod): string {
    const now = new Date();
    if (period === 'DAILY') {
      return now.toISOString().split('T')[0];
    }
    if (period === 'MONTHLY') {
      return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    }
    return 'INFINITE';
  }

  async createRule(rule: LimitRule): Promise<void> {
    await this.postgresAdapter.saveLimitRule(rule);
  }

  async getRule(ruleId: string): Promise<LimitRule | null> {
    return this.postgresAdapter.getRuleById(ruleId);
  }
}

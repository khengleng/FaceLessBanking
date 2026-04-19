import { randomUUID } from 'node:crypto';
import type { PostgresCaseAdapter } from '../adapters/postgres-case.adapter.js';
import { 
  buildMakerCheckerPolicy, 
  type MakerCheckerActionType, 
  type MakerCheckerDecision, 
  type MakerCheckerPolicy 
} from '../domain/maker-checker.js';
import { buildCase, type CaseRecord, type CaseType } from '../domain/case.js';

type MakerCheckerEventsPublisher = {
  emitCaseCreated: (record: CaseRecord) => Promise<void>;
  emitMakerCheckerPolicyApplied: (decision: MakerCheckerDecision, correlationId?: string) => Promise<void>;
};

export class MakerCheckerApplication {
  constructor(
    private readonly postgresAdapter: PostgresCaseAdapter,
    private readonly eventsPublisher: MakerCheckerEventsPublisher,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  async createPolicy(input: {
    actionType: MakerCheckerActionType;
    enabled?: boolean;
    thresholdAmount?: number;
    caseType: string;
  }): Promise<MakerCheckerPolicy> {
    const policy = buildMakerCheckerPolicy({
      policyId: randomUUID(),
      ...input,
      createdAt: new Date().toISOString()
    });

    await this.postgresAdapter.createMakerCheckerPolicy(policy);
    return policy;
  }

  async getPolicy(policyId: string): Promise<MakerCheckerPolicy | null> {
    return this.postgresAdapter.getMakerCheckerPolicyById(policyId);
  }

  async evaluateAction(params: {
    actionType: MakerCheckerActionType;
    amount?: number;
    referenceId: string;
    correlationId?: string;
  }): Promise<MakerCheckerDecision> {
    const { actionType, amount, referenceId, correlationId } = params;

    const policy = await this.postgresAdapter.findApplicableMakerCheckerPolicy(actionType, amount);

    if (!policy) {
      const decision: MakerCheckerDecision = {
        decisionId: randomUUID(),
        actionType,
        requiresApproval: false,
        evaluatedAt: new Date().toISOString()
      };
      await this.postgresAdapter.createMakerCheckerDecision(decision);
      return decision;
    }

    // Check idempotency (if needed, but usually we just create a new decision for each request)
    // However, if we want to avoid duplicate cases for the same referenceId
    // For now, we follow the requirement: create workflow review case if policy applies

    const caseId = randomUUID();
    const reviewCase = buildCase({
      caseId,
      caseType: policy.caseType as CaseType,
      referenceId,
      createdAt: new Date().toISOString()
    });

    await this.postgresAdapter.insertCase(reviewCase);
    await this.eventsPublisher.emitCaseCreated(reviewCase);

    const decision: MakerCheckerDecision = {
      decisionId: randomUUID(),
      actionType,
      requiresApproval: true,
      policyId: policy.policyId,
      caseId,
      evaluatedAt: new Date().toISOString()
    };

    await this.postgresAdapter.createMakerCheckerDecision(decision);
    await this.eventsPublisher.emitMakerCheckerPolicyApplied(decision, correlationId);

    return decision;
  }
}

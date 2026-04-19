import type { CaseAction } from '../domain/case-action.js';
import type { CaseRecord, CaseStatus, CaseType, OnboardingCaseStatus } from '../domain/case.js';
import type { MakerCheckerPolicy, MakerCheckerDecision } from '../domain/maker-checker.js';
import type { DisputeRecord, DisputeStatus } from '../domain/dispute.js';

export class PostgresCaseAdapter {
  private readonly casesById = new Map<string, CaseRecord>();

  private readonly actionsByCaseId = new Map<string, CaseAction[]>();
  private readonly casesByEntity = new Map<string, string>();
  private readonly processedWorkflowEvents = new Set<string>();
  private readonly policies = new Map<string, MakerCheckerPolicy>();
  private readonly decisions = new Map<string, MakerCheckerDecision>();
  private readonly processedMakerCheckerRequests = new Set<string>();
  private readonly disputes = new Map<string, DisputeRecord>();

  async insertCase(record: CaseRecord): Promise<void> {
    this.casesById.set(record.caseId, record);
    this.actionsByCaseId.set(record.caseId, []);
    if (record.entityType && record.entityId) {
      this.casesByEntity.set(this.entityKey(record.entityType, record.entityId), record.caseId);
    }
  }

  async findCaseById(caseId: string): Promise<CaseRecord | null> {
    return this.casesById.get(caseId) ?? null;
  }

  async getCaseById(caseId: string): Promise<CaseRecord | null> {
    return this.findCaseById(caseId);
  }

  async appendAction(action: CaseAction): Promise<void> {
    const actions = this.actionsByCaseId.get(action.caseId) ?? [];
    this.actionsByCaseId.set(action.caseId, [...actions, action]);
  }

  async findActions(caseId: string): Promise<CaseAction[]> {
    return this.actionsByCaseId.get(caseId) ?? [];
  }

  async listCasesByTypeAndFilters(input: {
    caseType: CaseType;
    status?: OnboardingCaseStatus;
    entityId?: string;
    limit: number;
    offset: number;
  }): Promise<CaseRecord[]> {
    const allCases = Array.from(this.casesById.values())
      .filter((record) => record.caseType === input.caseType)
      .filter((record) => (input.status ? record.status === input.status : true))
      .filter((record) => (input.entityId ? record.entityId === input.entityId : true))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    return allCases.slice(input.offset, input.offset + input.limit);
  }

  async updateCaseStatus(caseId: string, status: CaseStatus | OnboardingCaseStatus): Promise<void> {
    const record = this.casesById.get(caseId);
    if (!record) {
      return;
    }

    this.casesById.set(caseId, {
      ...record,
      status,
      updatedAt: new Date().toISOString()
    });
  }

  async getCaseByEntity(
    entityType: 'EKYC_SESSION' | 'CUSTOMER_ONBOARDING',
    entityId: string
  ): Promise<CaseRecord | null> {
    const caseId = this.casesByEntity.get(this.entityKey(entityType, entityId));
    if (!caseId) {
      return null;
    }

    return this.casesById.get(caseId) ?? null;
  }

  async createCase(record: CaseRecord): Promise<void> {
    await this.insertCase(record);
  }

  async createCaseAction(action: CaseAction): Promise<void> {
    await this.appendAction(action);
  }

  async hasProcessedWorkflowEvent(sourceEventId: string): Promise<boolean> {
    return this.processedWorkflowEvents.has(sourceEventId);
  }

  async markWorkflowEventProcessed(sourceEventId: string): Promise<void> {
    this.processedWorkflowEvents.add(sourceEventId);
  }

  async createMakerCheckerPolicy(policy: MakerCheckerPolicy): Promise<void> {
    this.policies.set(policy.policyId, policy);
  }

  async getMakerCheckerPolicyById(policyId: string): Promise<MakerCheckerPolicy | null> {
    return this.policies.get(policyId) ?? null;
  }

  async findApplicableMakerCheckerPolicy(actionType: string, amount?: number): Promise<MakerCheckerPolicy | null> {
    return Array.from(this.policies.values()).find(p => {
      if (!p.enabled || p.actionType !== actionType) return false;
      if (p.thresholdAmount !== undefined && (amount === undefined || amount < p.thresholdAmount)) return false;
      return true;
    }) ?? null;
  }

  async createMakerCheckerDecision(decision: MakerCheckerDecision): Promise<void> {
    this.decisions.set(decision.decisionId, decision);
  }

  async hasProcessedMakerCheckerRequest(actionId: string): Promise<boolean> {
    return this.processedMakerCheckerRequests.has(actionId);
  }

  async markMakerCheckerRequestProcessed(actionId: string): Promise<void> {
    this.processedMakerCheckerRequests.add(actionId);
  }

  async createDispute(dispute: DisputeRecord): Promise<void> {
    this.disputes.set(dispute.disputeId, dispute);
  }

  async getDisputeById(disputeId: string): Promise<DisputeRecord | null> {
    return this.disputes.get(disputeId) ?? null;
  }

  async updateDisputeStatus(disputeId: string, status: DisputeStatus, escalationLevel?: number): Promise<void> {
    const dispute = this.disputes.get(disputeId);
    if (dispute) {
      this.disputes.set(disputeId, {
        ...dispute,
        status,
        escalationLevel: escalationLevel ?? dispute.escalationLevel,
        updatedAt: new Date().toISOString()
      });
    }
  }

  private entityKey(entityType: string, entityId: string): string {
    return `${entityType}:${entityId}`;
  }
}

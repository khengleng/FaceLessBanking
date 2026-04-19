import { randomUUID } from 'node:crypto';

import type { PostgresCaseAdapter } from '../adapters/postgres-case.adapter.js';
import type {
  CreateCaseRequestDto,
  ListOnboardingCasesQueryDto,
  RecordCaseActionRequestDto
} from '../controllers/dtos/case.dto.js';
import { buildCaseAction, type CaseAction } from '../domain/case-action.js';
import { buildCase, isCaseType, type CaseRecord, type CaseType } from '../domain/case.js';
import { type OnboardingWorkflowStatus } from '../domain/onboarding-workflow.js';
import type { CaseEventsPublisher } from '../events/case.events.js';
import type { ManualReviewQueueMetrics } from '../events/metrics.js';

export type CreateCaseResult =
  | { kind: 'created'; record: CaseRecord; actions: CaseAction[] }
  | { kind: 'invalid_payload'; errors: string[] };

export type GetCaseResult =
  | { kind: 'found'; record: CaseRecord; actions: CaseAction[] }
  | { kind: 'not_found' };

export type GetCaseByEntityResult =
  | { kind: 'found'; record: CaseRecord; actions: CaseAction[] }
  | { kind: 'not_found' }
  | { kind: 'invalid_query'; errors: string[] };

export type ListOnboardingCasesResult =
  | { kind: 'listed'; records: CaseRecord[] }
  | { kind: 'invalid_query'; errors: string[] };

export type RecordCaseActionResult =
  | { kind: 'recorded'; record: CaseRecord; actions: CaseAction[] }
  | { kind: 'noop'; record: CaseRecord; actions: CaseAction[] }
  | { kind: 'invalid_payload'; errors: string[] }
  | { kind: 'invalid_transition'; errors: string[] }
  | { kind: 'case_not_found' }
  | { kind: 'not_onboarding_case' };

export class WorkflowCaseManagementApplication {
  constructor(
    private readonly postgresAdapter: PostgresCaseAdapter,
    private readonly eventsPublisher: CaseEventsPublisher,
    private readonly metrics: ManualReviewQueueMetrics
  ) {}

  async createCase(payload: CreateCaseRequestDto): Promise<CreateCaseResult> {
    const errors = validateCreateCasePayload(payload);
    if (errors.length > 0) {
      return { kind: 'invalid_payload', errors };
    }

    const now = new Date().toISOString();
    const baseRecord = buildCase({
      caseId: randomUUID(),
      caseType: payload.caseType as CaseType,
      referenceId: payload.referenceId,
      createdAt: now
    });
    const record = payload.caseType === 'onboarding-review'
      ? { ...baseRecord, status: 'NEW' as const }
      : baseRecord;

    await this.postgresAdapter.insertCase(record);
    await this.eventsPublisher.emitCaseCreated(record);

    return { kind: 'created', record, actions: [] };
  }

  async getCase(caseId: string): Promise<GetCaseResult> {
    const record = await this.postgresAdapter.getCaseById(caseId);
    if (!record || record.caseType !== 'onboarding-review') {
      return { kind: 'not_found' };
    }

    const actions = await this.postgresAdapter.findActions(caseId);
    return { kind: 'found', record, actions };
  }

  async getCaseByEntity(
    entityType: 'EKYC_SESSION' | 'CUSTOMER_ONBOARDING' | undefined,
    entityId: string | undefined
  ): Promise<GetCaseByEntityResult> {
    const errors: string[] = [];

    if (!entityType) {
      errors.push('entityType query param is required');
    }

    if (!entityId || entityId.trim().length < 2) {
      errors.push('entityId query param is required');
    }

    if (errors.length > 0) {
      return { kind: 'invalid_query', errors };
    }

    const resolvedEntityType = entityType as 'EKYC_SESSION' | 'CUSTOMER_ONBOARDING';
    const resolvedEntityId = entityId as string;
    const record = await this.postgresAdapter.getCaseByEntity(resolvedEntityType, resolvedEntityId);
    if (!record) {
      return { kind: 'not_found' };
    }

    const actions = await this.postgresAdapter.findActions(record.caseId);
    return { kind: 'found', record, actions };
  }

  async listOnboardingCases(query: ListOnboardingCasesQueryDto): Promise<ListOnboardingCasesResult> {
    const errors = validateListOnboardingCasesQuery(query);
    if (errors.length > 0) {
      return { kind: 'invalid_query', errors };
    }

    const records = await this.postgresAdapter.listCasesByTypeAndFilters({
      caseType: 'onboarding-review',
      status: query.status,
      entityId: query.entityId,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0
    });
    this.metrics.recordQueueListRequest();

    return { kind: 'listed', records };
  }

  async recordCaseAction(
    caseId: string,
    payload: RecordCaseActionRequestDto
  ): Promise<RecordCaseActionResult> {
    const errors = validateRecordActionPayload(payload);
    if (errors.length > 0) {
      return { kind: 'invalid_payload', errors };
    }

    const record = await this.postgresAdapter.getCaseById(caseId);
    if (!record) {
      return { kind: 'case_not_found' };
    }

    if (record.caseType !== 'onboarding-review') {
      return { kind: 'not_onboarding_case' };
    }

    const currentStatus = record.status as OnboardingWorkflowStatus;
    const nextStatus = deriveOnboardingStatus(payload.actionType);
    if (nextStatus === currentStatus) {
      this.metrics.recordActionNoop();
      const actions = await this.postgresAdapter.findActions(caseId);
      return { kind: 'noop', record, actions };
    }

    const transitionErrors = validateOnboardingTransition(currentStatus, nextStatus);
    if (transitionErrors.length > 0) {
      this.metrics.recordInvalidTransitionBlocked();
      return { kind: 'invalid_transition', errors: transitionErrors };
    }

    const action = buildCaseAction({
      actionId: randomUUID(),
      caseId,
      actionType: payload.actionType,
      actorId: payload.actorId ?? 'ops:placeholder',
      notes: payload.notes,
      reason: payload.reason,
      oldStatus: currentStatus,
      newStatus: nextStatus,
      createdAt: new Date().toISOString()
    });

    await this.postgresAdapter.createCaseAction(action);
    await this.postgresAdapter.updateCaseStatus(caseId, nextStatus);
    await this.eventsPublisher.emitCaseActionRecorded(action);
    this.metrics.recordActionApplied();

    const latestRecord = (await this.postgresAdapter.getCaseById(caseId)) ?? record;
    const actions = await this.postgresAdapter.findActions(caseId);

    return { kind: 'recorded', record: latestRecord, actions };
  }
}

function validateCreateCasePayload(payload: CreateCaseRequestDto): string[] {
  const errors: string[] = [];
  const allowedCreateCaseTypes: CaseType[] = ['onboarding-review', 'loan-review'];

  if (
    !payload.caseType ||
    !isCaseType(payload.caseType) ||
    !allowedCreateCaseTypes.includes(payload.caseType as CaseType)
  ) {
    errors.push(
      'caseType must be one of onboarding-review, loan-review'
    );
  }

  if (!payload.referenceId || payload.referenceId.trim().length < 3) {
    errors.push('referenceId must contain at least 3 characters');
  }

  return errors;
}

function validateRecordActionPayload(payload: RecordCaseActionRequestDto): string[] {
  const errors: string[] = [];
  const allowed = ['APPROVE', 'REJECT', 'HOLD', 'REQUEST_REVIEW'];

  if (!payload.actionType || !allowed.includes(payload.actionType)) {
    errors.push('actionType must be one of APPROVE, REJECT, HOLD, REQUEST_REVIEW');
  }

  if (payload.actorId !== undefined && payload.actorId.trim().length < 3) {
    errors.push('actorId must contain at least 3 characters when provided');
  }

  return errors;
}

function validateListOnboardingCasesQuery(query: ListOnboardingCasesQueryDto): string[] {
  const errors: string[] = [];

  if (
    query.status
    && !['NEW', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ON_HOLD'].includes(query.status)
  ) {
    errors.push('status must be one of NEW, IN_REVIEW, APPROVED, REJECTED, ON_HOLD');
  }

  if (query.limit !== undefined && (Number.isNaN(query.limit) || query.limit < 1 || query.limit > 200)) {
    errors.push('limit must be between 1 and 200');
  }

  if (query.offset !== undefined && (Number.isNaN(query.offset) || query.offset < 0)) {
    errors.push('offset must be 0 or greater');
  }

  if (query.entityId !== undefined && query.entityId.trim().length < 2) {
    errors.push('entityId must contain at least 2 characters when provided');
  }

  return errors;
}

function deriveOnboardingStatus(actionType: RecordCaseActionRequestDto['actionType']): OnboardingWorkflowStatus {
  if (actionType === 'APPROVE') {
    return 'APPROVED';
  }

  if (actionType === 'REJECT') {
    return 'REJECTED';
  }

  if (actionType === 'HOLD') {
    return 'ON_HOLD';
  }

  return 'IN_REVIEW';
}

function validateOnboardingTransition(
  currentStatus: OnboardingWorkflowStatus,
  nextStatus: OnboardingWorkflowStatus
): string[] {
  const allowedByStatus: Record<OnboardingWorkflowStatus, OnboardingWorkflowStatus[]> = {
    NEW: ['IN_REVIEW', 'ON_HOLD'],
    IN_REVIEW: ['ON_HOLD', 'APPROVED', 'REJECTED'],
    ON_HOLD: ['IN_REVIEW', 'APPROVED', 'REJECTED'],
    APPROVED: [],
    REJECTED: []
  };

  if (allowedByStatus[currentStatus].includes(nextStatus)) {
    return [];
  }

  return [`invalid transition ${currentStatus} -> ${nextStatus}`];
}

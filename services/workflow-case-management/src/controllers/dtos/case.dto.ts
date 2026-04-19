import type { CaseAction } from '../../domain/case-action.js';
import type { CaseRecord } from '../../domain/case.js';

export type CreateCaseRequestDto = {
  caseType: string;
  referenceId: string;
};

export type RecordCaseActionRequestDto = {
  actionType: 'APPROVE' | 'REJECT' | 'HOLD' | 'REQUEST_REVIEW';
  actorId?: string;
  notes?: string;
  reason?: string;
};

export type ListOnboardingCasesQueryDto = {
  status?: 'NEW' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'ON_HOLD';
  entityId?: string;
  limit?: number;
  offset?: number;
};

export type CaseResponseDto = CaseRecord & {
  actions: CaseAction[];
};

export function toCaseResponseDto(input: {
  record: CaseRecord;
  actions: CaseAction[];
}): CaseResponseDto {
  return {
    caseId: input.record.caseId,
    caseType: input.record.caseType,
    referenceId: input.record.referenceId,
    entityType: input.record.entityType,
    entityId: input.record.entityId,
    status: input.record.status,
    createdAt: input.record.createdAt,
    updatedAt: input.record.updatedAt,
    actions: input.actions
  };
}

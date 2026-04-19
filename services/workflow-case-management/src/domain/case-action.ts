export type CaseActionType =
  | 'submit'
  | 'assign'
  | 'approve'
  | 'reject'
  | 'comment'
  | 'close'
  | 'APPROVE'
  | 'REJECT'
  | 'HOLD'
  | 'REQUEST_REVIEW';

export type CaseAction = {
  actionId: string;
  caseId: string;
  actionType: CaseActionType;
  actorId: string;
  oldStatus?: string;
  newStatus?: string;
  reason?: string;
  sourceEventId?: string;
  notes?: string;
  createdAt: string;
};

export function buildCaseAction(input: {
  actionId: string;
  caseId: string;
  actionType: CaseActionType;
  actorId: string;
  oldStatus?: string;
  newStatus?: string;
  reason?: string;
  sourceEventId?: string;
  notes?: string;
  createdAt: string;
}): CaseAction {
  return {
    actionId: input.actionId,
    caseId: input.caseId,
    actionType: input.actionType,
    actorId: input.actorId,
    oldStatus: input.oldStatus,
    newStatus: input.newStatus,
    reason: input.reason,
    sourceEventId: input.sourceEventId,
    notes: input.notes,
    createdAt: input.createdAt
  };
}

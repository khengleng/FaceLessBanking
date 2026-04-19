export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'ESCALATED' | 'RESOLVED' | 'REJECTED';

export type DisputeRecord = {
  disputeId: string;
  entityType: 'payment' | 'account' | 'loan';
  entityId: string;
  customerId: string;
  amount: number;
  currency: string;
  status: DisputeStatus;
  reason: string;
  escalationLevel: number;
  createdAt: string;
  updatedAt: string;
};

export function buildDispute(input: {
  disputeId: string;
  entityType: 'payment' | 'account' | 'loan';
  entityId: string;
  customerId: string;
  amount: number;
  currency: string;
  reason: string;
  createdAt: string;
}): DisputeRecord {
  return {
    disputeId: input.disputeId,
    entityType: input.entityType,
    entityId: input.entityId,
    customerId: input.customerId,
    amount: input.amount,
    currency: input.currency,
    reason: input.reason,
    status: 'OPEN',
    escalationLevel: 0,
    createdAt: input.createdAt,
    updatedAt: input.createdAt
  };
}

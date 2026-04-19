export type FeeAssessmentStatus = 
  | 'ASSESSED' 
  | 'WAIVED' 
  | 'COLLECTION_PENDING' 
  | 'COLLECTED' 
  | 'FAILED';

export interface FeeAssessment {
  assessmentId: string;
  sourceEventId: string;
  sourceEntityType: string;
  sourceEntityId: string;
  customerId: string; // Added
  ruleId: string;
  assessedAmountCents: number;
  currency: string;
  status: FeeAssessmentStatus;
  paymentId?: string; // Added to track collection payment
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export function buildFeeAssessment(input: {
  assessmentId: string;
  sourceEventId: string;
  sourceEntityType: string;
  sourceEntityId: string;
  customerId: string;
  ruleId: string;
  amount: number;
  currency: string;
  createdAt: string;
}): FeeAssessment {
  return {
    assessmentId: input.assessmentId,
    sourceEventId: input.sourceEventId,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    customerId: input.customerId,
    ruleId: input.ruleId,
    assessedAmountCents: input.amount,
    currency: input.currency,
    status: 'ASSESSED',
    createdAt: input.createdAt,
    updatedAt: input.createdAt
  };
}

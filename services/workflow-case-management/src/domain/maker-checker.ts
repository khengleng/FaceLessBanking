export type MakerCheckerActionType = 
  | 'MANUAL_ACCOUNT_ACTIVATION' 
  | 'LOAN_APPROVAL' 
  | 'MANUAL_PAYMENT_RELEASE' 
  | 'MANUAL_FEE_WAIVER';

export type MakerCheckerPolicy = {
  policyId: string;
  actionType: MakerCheckerActionType;
  enabled: boolean;
  thresholdAmount?: number;
  caseType: string;
  createdAt: string;
};

export type MakerCheckerDecision = {
  decisionId: string;
  actionType: MakerCheckerActionType;
  requiresApproval: boolean;
  policyId?: string;
  caseId?: string;
  evaluatedAt: string;
};

export function buildMakerCheckerPolicy(input: {
  policyId: string;
  actionType: MakerCheckerActionType;
  enabled?: boolean;
  thresholdAmount?: number;
  caseType: string;
  createdAt: string;
}): MakerCheckerPolicy {
  return {
    policyId: input.policyId,
    actionType: input.actionType,
    enabled: input.enabled ?? true,
    thresholdAmount: input.thresholdAmount,
    caseType: input.caseType,
    createdAt: input.createdAt
  };
}

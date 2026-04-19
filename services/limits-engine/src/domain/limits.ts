export type LimitEntityType = 'CUSTOMER' | 'ACCOUNT';
export type LimitType = 
  | 'DAILY_TX_LIMIT' 
  | 'MONTHLY_TX_LIMIT' 
  | 'LOAN_EXPOSURE_LIMIT' 
  | 'ACCOUNT_BALANCE_LIMIT';
export type LimitPeriod = 'DAILY' | 'MONTHLY' | 'INFINITE';

export interface LimitRule {
  ruleId: string;
  entityType: LimitEntityType;
  entityId: string; // Optional: can be a specific ID or 'ALL'
  limitType: LimitType;
  thresholdAmountCents: bigint;
  currency: string;
  period: LimitPeriod;
  status: 'ACTIVE' | 'INACTIVE';
  requireApproval: boolean;
}

export interface LimitUsage {
  usageId: string;
  ruleId: string;
  entityId: string;
  periodKey: string; // e.g. "2026-04-16"
  usedAmountCents: bigint;
  updatedAt: string;
}

export type EvaluationDecision = 'ALLOWED' | 'BLOCKED' | 'OVERRIDE_REQUIRED';

export interface EvaluationResult {
  decision: EvaluationDecision;
  ruleId?: string;
  reason?: string;
}

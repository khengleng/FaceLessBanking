export const CASE_TYPES = [
  'onboarding-review',
  'loan-review',
  'compliance-review',
  'dispute-review'
] as const;

export type CaseType = (typeof CASE_TYPES)[number];

export type CaseStatus = 'open' | 'in_review' | 'approved' | 'rejected' | 'closed';
export type OnboardingCaseStatus = 'NEW' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'ON_HOLD';

export type CaseRecord = {
  caseId: string;
  caseType: CaseType;
  referenceId: string;
  entityType?: 'EKYC_SESSION' | 'CUSTOMER_ONBOARDING';
  entityId?: string;
  status: CaseStatus | OnboardingCaseStatus;
  createdAt: string;
  updatedAt: string;
};

export function isCaseType(value: string): value is CaseType {
  return CASE_TYPES.includes(value as CaseType);
}

export function buildCase(input: {
  caseId: string;
  caseType: CaseType;
  referenceId: string;
  createdAt: string;
}): CaseRecord {
  return {
    caseId: input.caseId,
    caseType: input.caseType,
    referenceId: input.referenceId,
    status: 'open',
    createdAt: input.createdAt,
    updatedAt: input.createdAt
  };
}

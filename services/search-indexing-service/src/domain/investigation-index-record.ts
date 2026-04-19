export const INVESTIGATION_ENTITY_TYPES = [
  'CUSTOMER',
  'ACCOUNT',
  'PAYMENT',
  'ONBOARDING_CASE'
] as const;

export type InvestigationEntityType = (typeof INVESTIGATION_ENTITY_TYPES)[number];

export type InvestigationIndexRecord = {
  indexId: string;
  entityType: InvestigationEntityType;
  entityId: string;
  correlationId?: string;
  customerId?: string;
  accountId?: string;
  paymentId?: string;
  caseId?: string;
  status?: string;
  searchableText: string;
  sourceEventId: string;
  createdAt: string;
  updatedAt: string;
};

export type InvestigationSearchQuery = {
  q?: string;
  entityType?: InvestigationEntityType;
  customerId?: string;
  accountId?: string;
  paymentId?: string;
  caseId?: string;
  status?: string;
  correlationId?: string;
  limit: number;
  offset: number;
};

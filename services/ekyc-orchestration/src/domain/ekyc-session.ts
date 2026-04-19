export type EkycStatus =
  | 'INITIATED'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'ON_HOLD'
  | 'session_created'
  | 'documents_submitted'
  | 'liveness_submitted'
  | 'under_review';

export type EkycSession = {
  sessionId: string;
  customerId: string;
  internalCustomerId?: string;
  countryCode: string;
  provider: 'SUMSUB';
  sumsubApplicantId: string;
  verificationLevel?: string;
  status: EkycStatus;
  reviewResult?: string;
  documentIds: string[];
  ocrResult: 'pending' | 'passed';
  livenessResult: 'pending' | 'passed';
  amlResult: 'pending' | 'clear';
  createdAt: string;
  updatedAt: string;
};

export type NewEkycSession = {
  sessionId: string;
  customerId: string;
  countryCode: string;
  createdAt: string;
};

export function buildEkycSession(input: NewEkycSession): EkycSession {
  return {
    sessionId: input.sessionId,
    customerId: input.customerId,
    internalCustomerId: input.customerId,
    countryCode: input.countryCode,
    provider: 'SUMSUB',
    sumsubApplicantId: `sumsub-applicant-${input.sessionId}`,
    status: 'session_created',
    reviewResult: undefined,
    documentIds: [],
    ocrResult: 'pending',
    livenessResult: 'pending',
    amlResult: 'pending',
    createdAt: input.createdAt,
    updatedAt: input.createdAt
  };
}

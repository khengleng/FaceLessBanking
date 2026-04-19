import type { EkycSession } from '../../domain/ekyc-session.js';

export type CreateSessionRequestDto = {
  customerId: string;
  countryCode: string;
};

export type UploadDocumentsRequestDto = {
  documents: Array<{
    type: string;
    fileReference: string;
  }>;
};

export type SubmitLivenessRequestDto = {
  selfieReference: string;
  challengeToken: string;
};

export type EkycSessionResponseDto = {
  sessionId: string;
  customerId: string;
  internalCustomerId?: string;
  countryCode: string;
  provider: 'SUMSUB';
  sumsubApplicantId: string;
  verificationLevel?: string;
  status: string;
  reviewResult?: string;
  documentIds: string[];
  ocrResult: string;
  livenessResult: string;
  amlResult: string;
  createdAt: string;
  updatedAt: string;
};

export function toEkycSessionResponseDto(session: EkycSession): EkycSessionResponseDto {
  return {
    sessionId: session.sessionId,
    customerId: session.customerId,
    internalCustomerId: session.internalCustomerId,
    countryCode: session.countryCode,
    provider: session.provider,
    sumsubApplicantId: session.sumsubApplicantId,
    verificationLevel: session.verificationLevel,
    status: session.status,
    reviewResult: session.reviewResult,
    documentIds: session.documentIds,
    ocrResult: session.ocrResult,
    livenessResult: session.livenessResult,
    amlResult: session.amlResult,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  };
}

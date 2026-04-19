import type { EkycStatus } from './ekyc-session.js';

export type SumsubReviewInput = {
  reviewStatus?: string;
  reviewResultAnswer?: string;
  reviewRejectType?: string;
};

export type SumsubMappedStatus = {
  newStatus: EkycStatus;
  reviewResult?: string;
};

export function mapSumsubReviewToInternalStatus(input: SumsubReviewInput): SumsubMappedStatus {
  const reviewStatus = input.reviewStatus?.toUpperCase();
  const reviewAnswer = input.reviewResultAnswer?.toUpperCase();
  const rejectType = input.reviewRejectType?.toUpperCase();

  if (reviewAnswer === 'GREEN') {
    return { newStatus: 'APPROVED', reviewResult: 'GREEN' };
  }

  if (reviewAnswer === 'RED') {
    return { newStatus: 'REJECTED', reviewResult: 'RED' };
  }

  if (reviewStatus === 'ON_HOLD' || reviewStatus === 'ONHOLD' || rejectType === 'RETRY') {
    return { newStatus: 'ON_HOLD', reviewResult: rejectType ?? reviewStatus };
  }

  if (reviewStatus === 'INITIATED' || reviewStatus === 'INIT') {
    return { newStatus: 'INITIATED' };
  }

  if (reviewStatus === 'PENDING' || reviewStatus === 'PENDING_REVIEW' || reviewStatus === 'QUEUED') {
    return { newStatus: 'PENDING_REVIEW' };
  }

  // TODO: refine mapping once exact Sumsub webhook variants are finalized.
  return {
    newStatus: 'PENDING_REVIEW',
    reviewResult: reviewAnswer ?? reviewStatus
  };
}

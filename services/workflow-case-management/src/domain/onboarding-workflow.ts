export type OnboardingWorkflowStatus = 'NEW' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'ON_HOLD';

export function mapEkycToOnboardingStatus(ekycStatus: string): OnboardingWorkflowStatus | null {
  if (ekycStatus === 'APPROVED') {
    return 'APPROVED';
  }

  if (ekycStatus === 'REJECTED') {
    return 'REJECTED';
  }

  if (ekycStatus === 'ON_HOLD') {
    return 'ON_HOLD';
  }

  if (ekycStatus === 'PENDING_REVIEW') {
    return 'IN_REVIEW';
  }

  return null;
}

export function isValidOnboardingTransition(
  currentStatus: OnboardingWorkflowStatus,
  nextStatus: OnboardingWorkflowStatus
): boolean {
  if (currentStatus === nextStatus) {
    return false;
  }

  const transitions: Record<OnboardingWorkflowStatus, OnboardingWorkflowStatus[]> = {
    NEW: ['IN_REVIEW', 'ON_HOLD', 'APPROVED', 'REJECTED'],
    IN_REVIEW: ['ON_HOLD', 'APPROVED', 'REJECTED'],
    ON_HOLD: ['IN_REVIEW', 'APPROVED', 'REJECTED'],
    APPROVED: [],
    REJECTED: []
  };

  return transitions[currentStatus].includes(nextStatus);
}

export function deriveActionType(nextStatus: OnboardingWorkflowStatus): 'submit' | 'approve' | 'reject' | 'assign' {
  if (nextStatus === 'APPROVED') {
    return 'approve';
  }

  if (nextStatus === 'REJECTED') {
    return 'reject';
  }

  if (nextStatus === 'ON_HOLD') {
    return 'assign';
  }

  return 'submit';
}

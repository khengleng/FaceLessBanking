export type NotificationRequestStatus = 'REQUESTED' | 'QUEUED' | 'SENT' | 'FAILED';

export type NotificationRequestChannel = 'push' | 'sms' | 'email';

export type NotificationRequest = {
  notificationId: string;
  eventId: string;
  correlationId: string;
  entityType: 'payment' | 'ekyc_session' | 'onboarding_case' | 'customer_onboarding';
  entityId: string;
  customerId?: string;
  channel: NotificationRequestChannel;
  templateKey: string;
  payload: Record<string, unknown>;
  status: NotificationRequestStatus;
  deliveryAttemptCount: number;
  createdAt: string;
  updatedAt: string;
};

export function buildNotificationRequest(input: {
  notificationId: string;
  eventId: string;
  correlationId: string;
  entityType: 'payment' | 'ekyc_session' | 'onboarding_case' | 'customer_onboarding';
  entityId: string;
  customerId?: string;
  channel: NotificationRequestChannel;
  templateKey: string;
  payload: Record<string, unknown>;
  status?: NotificationRequestStatus;
  deliveryAttemptCount?: number;
  createdAt: string;
  updatedAt?: string;
}): NotificationRequest {
  return {
    notificationId: input.notificationId,
    eventId: input.eventId,
    correlationId: input.correlationId,
    entityType: input.entityType,
    entityId: input.entityId,
    customerId: input.customerId,
    channel: input.channel,
    templateKey: input.templateKey,
    payload: input.payload,
    status: input.status ?? 'REQUESTED',
    deliveryAttemptCount: input.deliveryAttemptCount ?? 0,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt ?? input.createdAt
  };
}

export function mapPaymentStatusToTemplateKey(status: string): string | null {
  if (status === 'COMPLETED') {
    return 'payment.completed.v1';
  }

  if (status === 'FAILED') {
    return 'payment.failed.v1';
  }

  return null;
}

export function mapEkycStatusToTemplateKey(status: string): string | null {
  if (status === 'APPROVED') {
    return 'onboarding.ekyc.approved.v1';
  }

  if (status === 'REJECTED') {
    return 'onboarding.ekyc.rejected.v1';
  }

  if (status === 'ON_HOLD') {
    return 'onboarding.ekyc.on_hold.v1';
  }

  return null;
}

export function mapOnboardingCaseStatusToTemplateKey(status: string): string | null {
  if (status === 'APPROVED') {
    return 'onboarding.case.approved.v1';
  }

  if (status === 'REJECTED') {
    return 'onboarding.case.rejected.v1';
  }

  return null;
}

export function maskAccountId(accountId: string): string {
  if (accountId.length <= 4) {
    return '****';
  }

  return `****${accountId.slice(-4)}`;
}

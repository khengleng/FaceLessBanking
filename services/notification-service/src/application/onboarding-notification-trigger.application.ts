import { randomUUID } from 'node:crypto';

import type { PostgresNotificationAdapter } from '../adapters/postgres-notification.adapter.js';
import type { NotificationRequest } from '../domain/notification-request.js';
import {
  buildNotificationRequest,
  mapEkycStatusToTemplateKey,
  mapOnboardingCaseStatusToTemplateKey,
  type NotificationRequestChannel
} from '../domain/notification-request.js';
import type { NotificationEventsPublisher } from '../events/notification.events.js';
import type { NotificationTriggerMetrics } from '../events/metrics.js';

type TriggerSource = 'ekyc.status.updated.v1' | 'case.action.recorded.v1';

type BaseResult =
  | { kind: 'created'; notification: NotificationRequest; source: TriggerSource }
  | { kind: 'ignored_status'; status: string; source: TriggerSource }
  | { kind: 'duplicate'; source: TriggerSource }
  | { kind: 'invalid_event'; reason: string; source: TriggerSource };

export type ProcessOnboardingStatusEventResult = BaseResult;

type EkycStatusUpdatedEvent = {
  specVersion: '1.0';
  type: 'ekyc.status.updated.v1';
  version: number;
  metadata: {
    eventId: string;
    correlationId: string;
    causationId?: string;
    timestamp: string;
    producer: string;
  };
  payload: {
    sessionId: string;
    customerId?: string;
    provider?: string;
    newStatus?: string;
    status: string;
    reviewResult?: string;
  };
};

type CaseActionRecordedEvent = {
  specVersion: '1.0';
  type: 'case.action.recorded.v1';
  version: number;
  metadata: {
    eventId: string;
    correlationId: string;
    causationId?: string;
    timestamp: string;
    producer: string;
  };
  payload: {
    caseId: string;
    actionId: string;
    actionType?: string;
    newStatus?: string;
    reason?: string;
  };
};

export class OnboardingNotificationTriggerApplication {
  constructor(
    private readonly postgresAdapter: PostgresNotificationAdapter,
    private readonly notificationEvents: NotificationEventsPublisher,
    private readonly metrics: NotificationTriggerMetrics,
    private readonly defaultChannel: NotificationRequestChannel,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  async processEkycStatusUpdated(rawEvent: unknown): Promise<ProcessOnboardingStatusEventResult> {
    const source: TriggerSource = 'ekyc.status.updated.v1';
    const event = parseEkycStatusUpdatedEvent(rawEvent);
    if (!event) {
      return { kind: 'invalid_event', reason: 'invalid_event_envelope', source };
    }

    const status = event.payload.newStatus ?? event.payload.status;
    const templateKey = mapEkycStatusToTemplateKey(status);
    if (!templateKey) {
      return { kind: 'ignored_status', status, source };
    }

    const existingBySource = await this.postgresAdapter.findNotificationBySourceEventAndTemplate(
      event.metadata.eventId,
      templateKey
    );
    if (existingBySource) {
      this.metrics.recordDuplicateOnboardingNotificationsSkipped();
      return { kind: 'duplicate', source };
    }

    const entityType = event.payload.customerId ? 'customer_onboarding' : 'ekyc_session';
    const entityId = event.payload.customerId ?? event.payload.sessionId;
    const existingByOutcome = await this.postgresAdapter.findNotificationByOutcome(
      entityType,
      entityId,
      templateKey
    );
    if (existingByOutcome) {
      this.metrics.recordDuplicateOnboardingNotificationsSkipped();
      return { kind: 'duplicate', source };
    }

    const now = new Date().toISOString();
    const notification = buildNotificationRequest({
      notificationId: randomUUID(),
      eventId: event.metadata.eventId,
      correlationId: event.metadata.correlationId,
      entityType,
      entityId,
      channel: this.defaultChannel,
      templateKey,
      payload: {
        onboardingEntityId: entityId,
        status,
        templateKey,
        provider: event.payload.provider ?? 'SUMSUB',
        reason: event.payload.reviewResult ?? 'N/A',
        paymentId: entityId,
        amount: 0,
        currency: 'N/A',
        destinationAccountIdMasked: 'N/A'
      },
      status: 'REQUESTED',
      createdAt: now,
      updatedAt: now
    });

    await this.postgresAdapter.createNotificationRequest(notification);
    await this.notificationEvents.emitNotificationRequestedV1(notification);

    this.metrics.recordOnboardingNotificationsCreated();
    this.metrics.recordOnboardingNotificationEventsPublished();

    this.logger.info(
      {
        correlationId: event.metadata.correlationId,
        sourceEventId: event.metadata.eventId,
        entityId,
        status,
        templateKey
      },
      'Created onboarding notification request from ekyc status event'
    );

    return { kind: 'created', notification, source };
  }

  async processCaseActionRecorded(rawEvent: unknown): Promise<ProcessOnboardingStatusEventResult> {
    const source: TriggerSource = 'case.action.recorded.v1';
    const event = parseCaseActionRecordedEvent(rawEvent);
    if (!event) {
      return { kind: 'invalid_event', reason: 'invalid_event_envelope', source };
    }

    const status = event.payload.newStatus ?? '';
    const templateKey = mapOnboardingCaseStatusToTemplateKey(status);
    if (!templateKey) {
      return { kind: 'ignored_status', status: status || 'UNKNOWN', source };
    }

    const existingBySource = await this.postgresAdapter.findNotificationBySourceEventAndTemplate(
      event.metadata.eventId,
      templateKey
    );
    if (existingBySource) {
      this.metrics.recordDuplicateOnboardingNotificationsSkipped();
      return { kind: 'duplicate', source };
    }

    const entityType = 'onboarding_case';
    const entityId = event.payload.caseId;
    const existingByOutcome = await this.postgresAdapter.findNotificationByOutcome(
      entityType,
      entityId,
      templateKey
    );
    if (existingByOutcome) {
      this.metrics.recordDuplicateOnboardingNotificationsSkipped();
      return { kind: 'duplicate', source };
    }

    const now = new Date().toISOString();
    const notification = buildNotificationRequest({
      notificationId: randomUUID(),
      eventId: event.metadata.eventId,
      correlationId: event.metadata.correlationId,
      entityType,
      entityId,
      channel: this.defaultChannel,
      templateKey,
      payload: {
        onboardingEntityId: entityId,
        status,
        templateKey,
        provider: 'WORKFLOW_CASE_MANAGEMENT',
        reason: event.payload.reason ?? 'N/A',
        paymentId: entityId,
        amount: 0,
        currency: 'N/A',
        destinationAccountIdMasked: 'N/A'
      },
      status: 'REQUESTED',
      createdAt: now,
      updatedAt: now
    });

    await this.postgresAdapter.createNotificationRequest(notification);
    await this.notificationEvents.emitNotificationRequestedV1(notification);

    this.metrics.recordOnboardingNotificationsCreated();
    this.metrics.recordOnboardingNotificationEventsPublished();

    this.logger.info(
      {
        correlationId: event.metadata.correlationId,
        sourceEventId: event.metadata.eventId,
        entityId,
        status,
        templateKey
      },
      'Created onboarding notification request from case action event'
    );

    return { kind: 'created', notification, source };
  }
}

function parseEkycStatusUpdatedEvent(rawEvent: unknown): EkycStatusUpdatedEvent | null {
  if (!rawEvent || typeof rawEvent !== 'object') {
    return null;
  }

  const event = rawEvent as Record<string, unknown>;
  if (event.specVersion !== '1.0' || event.type !== 'ekyc.status.updated.v1' || typeof event.version !== 'number') {
    return null;
  }

  const metadata = event.metadata as Record<string, unknown> | undefined;
  const payload = event.payload as Record<string, unknown> | undefined;
  if (!metadata || !payload) {
    return null;
  }

  if (
    typeof metadata.eventId !== 'string'
    || typeof metadata.correlationId !== 'string'
    || typeof metadata.timestamp !== 'string'
    || typeof metadata.producer !== 'string'
  ) {
    return null;
  }

  if (typeof payload.sessionId !== 'string' || typeof payload.status !== 'string') {
    return null;
  }

  if (payload.newStatus !== undefined && typeof payload.newStatus !== 'string') {
    return null;
  }

  if (payload.customerId !== undefined && typeof payload.customerId !== 'string') {
    return null;
  }

  if (payload.provider !== undefined && typeof payload.provider !== 'string') {
    return null;
  }

  if (payload.reviewResult !== undefined && typeof payload.reviewResult !== 'string') {
    return null;
  }

  return event as EkycStatusUpdatedEvent;
}

function parseCaseActionRecordedEvent(rawEvent: unknown): CaseActionRecordedEvent | null {
  if (!rawEvent || typeof rawEvent !== 'object') {
    return null;
  }

  const event = rawEvent as Record<string, unknown>;
  if (event.specVersion !== '1.0' || event.type !== 'case.action.recorded.v1' || typeof event.version !== 'number') {
    return null;
  }

  const metadata = event.metadata as Record<string, unknown> | undefined;
  const payload = event.payload as Record<string, unknown> | undefined;
  if (!metadata || !payload) {
    return null;
  }

  if (
    typeof metadata.eventId !== 'string'
    || typeof metadata.correlationId !== 'string'
    || typeof metadata.timestamp !== 'string'
    || typeof metadata.producer !== 'string'
  ) {
    return null;
  }

  if (typeof payload.caseId !== 'string' || typeof payload.actionId !== 'string') {
    return null;
  }

  if (payload.actionType !== undefined && typeof payload.actionType !== 'string') {
    return null;
  }

  if (payload.newStatus !== undefined && typeof payload.newStatus !== 'string') {
    return null;
  }

  if (payload.reason !== undefined && typeof payload.reason !== 'string') {
    return null;
  }

  return event as CaseActionRecordedEvent;
}

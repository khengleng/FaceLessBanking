import { randomUUID } from 'node:crypto';

import type { PostgresNotificationAdapter } from '../adapters/postgres-notification.adapter.js';
import type { NotificationRequest } from '../domain/notification-request.js';
import {
  buildNotificationRequest,
  mapPaymentStatusToTemplateKey,
  maskAccountId,
  type NotificationRequestChannel
} from '../domain/notification-request.js';
import type { NotificationEventsPublisher } from '../events/notification.events.js';
import type { NotificationTriggerMetrics } from '../events/metrics.js';

export type ProcessPaymentStatusUpdatedResult =
  | { kind: 'created'; notification: NotificationRequest }
  | { kind: 'ignored_status'; status: string }
  | { kind: 'duplicate' }
  | { kind: 'invalid_event'; reason: string };

type PaymentStatusUpdatedEvent = {
  specVersion: '1.0';
  type: 'payment.status.updated.v1';
  version: number;
  metadata: {
    eventId: string;
    correlationId: string;
    causationId?: string;
    timestamp: string;
    producer: string;
  };
  payload: {
    paymentId: string;
    sourceAccountId: string;
    destinationAccountId: string;
    amount: number;
    currency: string;
    previousStatus: string;
    status: string;
    reason: string;
  };
};

export class PaymentNotificationTriggerApplication {
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

  async processPaymentStatusUpdated(rawEvent: unknown): Promise<ProcessPaymentStatusUpdatedResult> {
    const event = parsePaymentStatusUpdatedEvent(rawEvent);
    if (!event) {
      return { kind: 'invalid_event', reason: 'invalid_event_envelope' };
    }

    const templateKey = mapPaymentStatusToTemplateKey(event.payload.status);
    if (!templateKey) {
      this.logger.info(
        {
          eventId: event.metadata.eventId,
          correlationId: event.metadata.correlationId,
          status: event.payload.status
        },
        'Ignoring payment status for notification trigger'
      );
      return { kind: 'ignored_status', status: event.payload.status };
    }

    const existing = await this.postgresAdapter.findNotificationBySourceEventAndTemplate(
      event.metadata.eventId,
      templateKey
    );

    if (existing) {
      this.metrics.recordDuplicateNotificationsSkipped();
      this.logger.info(
        {
          eventId: event.metadata.eventId,
          correlationId: event.metadata.correlationId,
          templateKey,
          notificationId: existing.notificationId
        },
        'Skipping duplicate notification request'
      );
      return { kind: 'duplicate' };
    }

    const now = new Date().toISOString();
    const notification = buildNotificationRequest({
      notificationId: randomUUID(),
      eventId: event.metadata.eventId,
      correlationId: event.metadata.correlationId,
      entityType: 'payment',
      entityId: event.payload.paymentId,
      channel: this.defaultChannel,
      templateKey,
      payload: {
        sourceEventId: event.metadata.eventId,
        paymentId: event.payload.paymentId,
        status: event.payload.status,
        channel: this.defaultChannel,
        templateKey,
        amount: event.payload.amount,
        currency: event.payload.currency,
        destinationAccountIdMasked: maskAccountId(event.payload.destinationAccountId)
      },
      status: 'REQUESTED',
      createdAt: now,
      updatedAt: now
    });

    await this.postgresAdapter.createNotificationRequest(notification);
    await this.notificationEvents.emitNotificationRequestedV1(notification);
    this.metrics.recordNotificationRequestsCreated();
    this.metrics.recordNotificationEventsPublished();

    this.logger.info(
      {
        eventId: event.metadata.eventId,
        correlationId: event.metadata.correlationId,
        notificationId: notification.notificationId,
        paymentId: event.payload.paymentId,
        status: event.payload.status,
        templateKey
      },
      'Created notification request from payment status event'
    );

    return { kind: 'created', notification };
  }
}

function parsePaymentStatusUpdatedEvent(rawEvent: unknown): PaymentStatusUpdatedEvent | null {
  if (!rawEvent || typeof rawEvent !== 'object') {
    return null;
  }

  const event = rawEvent as Record<string, unknown>;

  if (event.specVersion !== '1.0' || event.type !== 'payment.status.updated.v1') {
    return null;
  }

  if (typeof event.version !== 'number') {
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

  if (
    typeof payload.paymentId !== 'string'
    || typeof payload.sourceAccountId !== 'string'
    || typeof payload.destinationAccountId !== 'string'
    || typeof payload.amount !== 'number'
    || typeof payload.currency !== 'string'
    || typeof payload.previousStatus !== 'string'
    || typeof payload.status !== 'string'
    || typeof payload.reason !== 'string'
  ) {
    return null;
  }

  return event as PaymentStatusUpdatedEvent;
}

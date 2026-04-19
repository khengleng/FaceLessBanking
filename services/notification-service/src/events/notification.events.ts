import { randomUUID } from 'node:crypto';

import { buildEventEnvelope } from '@faceless-banking/shared-events';

import type { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import type { Notification } from '../domain/notification.js';
import type { NotificationRequest } from '../domain/notification-request.js';

export class NotificationEventsPublisher {
  constructor(private readonly kafkaProducer: KafkaProducerAdapter) {}

  async emitNotificationRequested(notification: Notification): Promise<void> {
    const event = buildEventEnvelope({
      type: 'notification.requested.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: 'notification-api-request',
        timestamp: new Date().toISOString(),
        producer: 'notification-service'
      },
      payload: {
        notificationId: notification.notificationId,
        sourceEventId: 'notification-service.api',
        paymentId: 'n/a',
        status: notification.status.toUpperCase(),
        channel: notification.channel,
        templateKey: 'notification.manual.requested.v1',
        amount: 0,
        currency: 'N/A',
        destinationAccountIdMasked: 'N/A'
      }
    });

    await this.kafkaProducer.publishNotificationRequested(event);
  }

  async emitNotificationRequestedV1(notification: NotificationRequest): Promise<{ published: boolean }> {
    const payload = notification.payload as Record<string, unknown>;
    const event = buildEventEnvelope({
      type: 'notification.requested.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: notification.correlationId,
        causationId: notification.eventId,
        timestamp: new Date().toISOString(),
        producer: 'notification-service'
      },
      payload: {
        notificationId: notification.notificationId,
        sourceEventId: notification.eventId,
        paymentId: String(payload.paymentId ?? notification.entityId),
        status: String(payload.status ?? 'REQUESTED'),
        channel: notification.channel,
        templateKey: notification.templateKey,
        amount: Number(payload.amount ?? 0),
        currency: String(payload.currency ?? 'N/A'),
        destinationAccountIdMasked: String(payload.destinationAccountIdMasked ?? 'N/A'),
        onboardingEntityId: payload.onboardingEntityId ?? notification.entityId,
        entityType: notification.entityType,
        provider: payload.provider,
        reason: payload.reason
      }
    });

    return this.kafkaProducer.publishNotificationRequested(event);
  }

  async emitNotificationSentV1(notification: NotificationRequest): Promise<void> {
    const event = buildEventEnvelope({
      type: 'notification.sent.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: notification.correlationId,
        causationId: notification.eventId,
        timestamp: new Date().toISOString(),
        producer: 'notification-service'
      },
      payload: {
        notificationId: notification.notificationId,
        sourceEventId: notification.eventId,
        channel: notification.channel,
        status: 'SENT',
        timestamp: new Date().toISOString()
      }
    });

    await this.kafkaProducer.publishNotificationSent(event);
  }

  async emitNotificationFailedV1(notification: NotificationRequest, reason: string): Promise<void> {
    const event = buildEventEnvelope({
      type: 'notification.failed.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: notification.correlationId,
        causationId: notification.eventId,
        timestamp: new Date().toISOString(),
        producer: 'notification-service'
      },
      payload: {
        notificationId: notification.notificationId,
        sourceEventId: notification.eventId,
        channel: notification.channel,
        status: 'FAILED',
        reason,
        timestamp: new Date().toISOString()
      }
    });

    await this.kafkaProducer.publishNotificationFailed(event);
  }
}

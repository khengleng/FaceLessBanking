import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { DeliveryWorkerApplication } from '../application/delivery-worker.application.js';
import { PostgresNotificationAdapter } from '../adapters/postgres-notification.adapter.js';
import { SmsProviderAdapterStub } from '../adapters/provider-sms.adapter.js';
import { EmailProviderAdapterStub } from '../adapters/provider-email.adapter.js';
import { PushProviderAdapterStub } from '../adapters/provider-push.adapter.js';
import { buildNotificationRequest } from '../domain/notification-request.js';
import type { NotificationRequest } from '../domain/notification-request.js';
import type { PushProviderRequest, ProviderDeliveryResult } from '../adapters/provider-push.adapter.js';

class FailingPushProviderStub extends PushProviderAdapterStub {
  async sendPush(request: PushProviderRequest): Promise<ProviderDeliveryResult> {
    void request;
    throw new Error('Provider down');
  }
}

type EventSpy = {
  sentCount: number;
  failedCount: number;
  failedReasons: string[];
};

function buildEventPublisherSpy(spy: EventSpy) {
  return {
    emitNotificationSentV1: async (notification: NotificationRequest) => {
      void notification;
      spy.sentCount += 1;
    },
    emitNotificationFailedV1: async (notification: NotificationRequest, reason: string) => {
      void notification;
      spy.failedCount += 1;
      spy.failedReasons.push(reason);
    }
  };
}

test('DeliveryWorkerApplication', async (t) => {
  const postgresAdapter = new PostgresNotificationAdapter();
  const smsProvider = new SmsProviderAdapterStub();
  const emailProvider = new EmailProviderAdapterStub();
  const pushProvider = new PushProviderAdapterStub();
  const logger = {
    info: (payload: Record<string, unknown>, message: string) => {
      void payload;
      void message;
    },
    warn: (payload: Record<string, unknown>, message: string) => {
      void payload;
      void message;
    },
    error: (payload: Record<string, unknown>, message: string) => {
      void payload;
      void message;
    }
  };

  const setupRequest = async (channel: 'sms' | 'email' | 'push') => {
    const notificationId = randomUUID();
    const request = buildNotificationRequest({
      notificationId,
      eventId: randomUUID(),
      correlationId: 'test-corr',
      entityType: 'payment',
      entityId: 'pay-123',
      channel,
      templateKey: 'test.template',
      payload: {},
      createdAt: new Date().toISOString()
    });
    await postgresAdapter.createNotificationRequest(request);
    return request;
  };

  await t.test('delivers SMS successfully and marks SENT', async () => {
    const eventSpy: EventSpy = { sentCount: 0, failedCount: 0, failedReasons: [] };
    const app = new DeliveryWorkerApplication(
      postgresAdapter,
      buildEventPublisherSpy(eventSpy),
      smsProvider,
      emailProvider,
      pushProvider,
      logger
    );
    const request = await setupRequest('sms');

    await app.processDelivery({
      eventId: randomUUID(),
      notificationId: request.notificationId,
      channel: 'sms',
      recipient: '+123456789',
      message: 'Hello'
    });

    const updated = await postgresAdapter.getNotificationById(request.notificationId);
    assert.equal(updated?.status, 'SENT');
    assert.equal(updated?.deliveryAttemptCount, 1);
    assert.equal(eventSpy.sentCount, 1);
  });

  await t.test('handles provider failure and marks FAILED', async () => {
    const eventSpy: EventSpy = { sentCount: 0, failedCount: 0, failedReasons: [] };
    const app = new DeliveryWorkerApplication(
      postgresAdapter,
      buildEventPublisherSpy(eventSpy),
      smsProvider,
      emailProvider,
      new FailingPushProviderStub(),
      logger
    );
    const request = await setupRequest('push');

    await app.processDelivery({
      eventId: randomUUID(),
      notificationId: request.notificationId,
      channel: 'push',
      recipient: 'recipient-1',
      message: 'Hello'
    });

    const updated = await postgresAdapter.getNotificationById(request.notificationId);
    assert.equal(updated?.status, 'FAILED');
    assert.equal(eventSpy.failedCount, 1);
    assert.equal(eventSpy.failedReasons[0], 'Provider down');
  });

  await t.test('duplicate event id is skipped idempotently', async () => {
    const eventSpy: EventSpy = { sentCount: 0, failedCount: 0, failedReasons: [] };
    const app = new DeliveryWorkerApplication(
      postgresAdapter,
      buildEventPublisherSpy(eventSpy),
      smsProvider,
      emailProvider,
      pushProvider,
      logger
    );
    const request = await setupRequest('email');
    const eventId = randomUUID();

    await app.processDelivery({
      eventId,
      notificationId: request.notificationId,
      channel: 'email',
      recipient: 'test@example.com',
      message: 'Hello'
    });

    await app.processDelivery({
      eventId,
      notificationId: request.notificationId,
      channel: 'email',
      recipient: 'test@example.com',
      message: 'Hello'
    });

    const updated = await postgresAdapter.getNotificationById(request.notificationId);
    assert.equal(updated?.deliveryAttemptCount, 1);
    assert.equal(eventSpy.sentCount, 1);
  });
});

import { randomUUID } from 'node:crypto';

import type { CreateNotificationRequestDto } from '../controllers/dtos/notification.dto.js';
import { buildNotification, isNotificationChannel, type Notification } from '../domain/notification.js';
import type { PostgresNotificationAdapter } from '../adapters/postgres-notification.adapter.js';
import type { SmsProviderAdapter } from '../adapters/provider-sms.adapter.js';
import type { EmailProviderAdapter } from '../adapters/provider-email.adapter.js';
import type { PushProviderAdapter } from '../adapters/provider-push.adapter.js';
import type { NotificationEventsPublisher } from '../events/notification.events.js';

export type CreateNotificationResult =
  | { kind: 'created'; notification: Notification }
  | { kind: 'invalid_payload'; errors: string[] }
  | { kind: 'invalid_channel'; channel: string };

export type GetNotificationResult =
  | { kind: 'found'; notification: Notification }
  | { kind: 'not_found' };

export class NotificationApplication {
  constructor(
    private readonly postgresAdapter: PostgresNotificationAdapter,
    private readonly smsProvider: SmsProviderAdapter,
    private readonly emailProvider: EmailProviderAdapter,
    private readonly pushProvider: PushProviderAdapter,
    private readonly notificationEvents: NotificationEventsPublisher
  ) {}

  async createNotification(payload: CreateNotificationRequestDto): Promise<CreateNotificationResult> {
    const errors = validatePayload(payload);
    if (errors.length > 0) {
      return { kind: 'invalid_payload', errors };
    }

    if (!isNotificationChannel(payload.channel)) {
      return { kind: 'invalid_channel', channel: payload.channel };
    }

    const providerMessageId = await sendByChannel(
      payload.channel,
      payload.recipient,
      payload.message,
      this.smsProvider,
      this.emailProvider,
      this.pushProvider
    );

    const notification = buildNotification({
      notificationId: randomUUID(),
      channel: payload.channel,
      recipient: payload.recipient,
      message: payload.message,
      providerMessageId,
      createdAt: new Date().toISOString()
    });

    await this.postgresAdapter.insertNotification(notification);
    await this.notificationEvents.emitNotificationRequested(notification);

    return { kind: 'created', notification };
  }

  async getNotificationById(notificationId: string): Promise<GetNotificationResult> {
    const notification = await this.postgresAdapter.findNotificationById(notificationId);

    if (!notification) {
      return { kind: 'not_found' };
    }

    return { kind: 'found', notification };
  }
}

function validatePayload(payload: CreateNotificationRequestDto): string[] {
  const errors: string[] = [];

  if (!payload.channel || payload.channel.trim().length === 0) {
    errors.push('channel is required');
  }

  if (!payload.recipient || payload.recipient.trim().length < 3) {
    errors.push('recipient must contain at least 3 characters');
  }

  if (!payload.message || payload.message.trim().length === 0) {
    errors.push('message is required');
  }

  return errors;
}

async function sendByChannel(
  channel: 'sms' | 'email' | 'push',
  recipient: string,
  message: string,
  smsProvider: SmsProviderAdapter,
  emailProvider: EmailProviderAdapter,
  pushProvider: PushProviderAdapter
): Promise<string> {
  if (channel === 'sms') {
    const result = await smsProvider.sendSms({ recipient, message });
    return result.providerMessageId;
  }

  if (channel === 'email') {
    const result = await emailProvider.sendEmail({ recipient, message });
    return result.providerMessageId;
  }

  const result = await pushProvider.sendPush({ recipient, message });
  return result.providerMessageId;
}

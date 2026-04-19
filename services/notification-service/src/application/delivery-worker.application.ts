import type { PostgresNotificationAdapter } from '../adapters/postgres-notification.adapter.js';
import type { SmsProviderAdapter } from '../adapters/provider-sms.adapter.js';
import type { EmailProviderAdapter } from '../adapters/provider-email.adapter.js';
import type { PushProviderAdapter } from '../adapters/provider-push.adapter.js';
import { 
  notificationsDeliveredCount, 
  notificationsFailedCount, 
  duplicateDeliveryEventsSkipped 
} from '../observability/metrics.js';
import type { NotificationRequest } from '../domain/notification-request.js';

type DeliveryEventsPublisher = {
  emitNotificationSentV1: (notification: NotificationRequest) => Promise<void>;
  emitNotificationFailedV1: (notification: NotificationRequest, reason: string) => Promise<void>;
};

export class DeliveryWorkerApplication {
  constructor(
    private readonly postgresAdapter: PostgresNotificationAdapter,
    private readonly eventPublisher: DeliveryEventsPublisher,
    private readonly smsProvider: SmsProviderAdapter,
    private readonly emailProvider: EmailProviderAdapter,
    private readonly pushProvider: PushProviderAdapter,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  async processDelivery(params: {
    eventId: string;
    notificationId: string;
    channel: string;
    recipient: string;
    message: string;
  }): Promise<void> {
    const { eventId, notificationId, channel, recipient, message } = params;

    // 1. Idempotency Check
    const alreadyProcessed = await this.postgresAdapter.hasProcessedNotificationDeliveryEvent(eventId);
    if (alreadyProcessed) {
      this.logger.info({ eventId, notificationId }, 'Notification delivery event already processed, skipping.');
      duplicateDeliveryEventsSkipped.inc();
      return;
    }

    const request = await this.postgresAdapter.getNotificationById(notificationId);
    if (!request) {
      this.logger.error({ notificationId, eventId }, 'Notification request not found for delivery.');
      return;
    }

    if (request.status === 'SENT' || request.status === 'FAILED') {
      this.logger.warn({ notificationId, status: request.status }, 'Notification already in terminal state, skipping.');
      await this.postgresAdapter.markNotificationDeliveryEventProcessed(eventId);
      return;
    }

    this.logger.info({ notificationId, channel }, `Attempting delivery for channel: ${channel}`);

    try {
      await this.postgresAdapter.incrementDeliveryAttempt(notificationId);
      
      let success = false;
      let providerMessageId: string | undefined;

      switch (channel) {
        case 'sms': {
          const smsResult = await this.smsProvider.sendSms({ recipient, message });
          providerMessageId = smsResult.providerMessageId;
          success = true;
          break;
        }
        case 'email': {
          const emailResult = await this.emailProvider.sendEmail({ recipient, message });
          providerMessageId = emailResult.providerMessageId;
          success = true;
          break;
        }
        case 'push': {
          const pushResult = await this.pushProvider.sendPush({ recipient, message });
          providerMessageId = pushResult.providerMessageId;
          success = true;
          break;
        }
        default:
          this.logger.error({ channel, notificationId }, 'Unknown notification channel.');
          await this.handleFailure(notificationId, channel, `Unknown channel: ${channel}`);
          return;
      }

      if (success) {
        await this.handleSuccess(notificationId, channel, providerMessageId);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Provider error';
      this.logger.error({ err, notificationId }, 'Provider delivery failed with exception.');
      await this.handleFailure(notificationId, channel, message);
    } finally {
      await this.postgresAdapter.markNotificationDeliveryEventProcessed(eventId);
    }
  }

  private async handleSuccess(notificationId: string, channel: string, providerMessageId?: string): Promise<void> {
    await this.postgresAdapter.updateNotificationStatus(notificationId, 'SENT');
    const request = await this.postgresAdapter.getNotificationById(notificationId);
    if (request) {
      notificationsDeliveredCount.inc({ channel });
      await this.eventPublisher.emitNotificationSentV1(request);
      this.logger.info({ notificationId, providerMessageId }, 'Notification delivered successfully.');
    }
  }

  private async handleFailure(notificationId: string, channel: string, reason: string): Promise<void> {
    await this.postgresAdapter.updateNotificationStatus(notificationId, 'FAILED');
    const request = await this.postgresAdapter.getNotificationById(notificationId);
    if (request) {
      notificationsFailedCount.inc({ channel, reason: reason.substring(0, 50) });
      await this.eventPublisher.emitNotificationFailedV1(request, reason);
      this.logger.warn({ notificationId, reason }, 'Notification delivery failed.');
    }
  }
}

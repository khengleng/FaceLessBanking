import type { EventEnvelope } from '@faceless-banking/shared-events';
import type { DeliveryWorkerApplication } from '../application/delivery-worker.application.js';

export class NotificationRequestedConsumer {
  constructor(private readonly deliveryApp: DeliveryWorkerApplication) {}

  async handle(event: unknown): Promise<void> {
    const envelope = event as EventEnvelope<'notification.requested.v1', {
      notificationId: string;
      channel: string;
      recipient?: string;
      message?: string;
      payload?: Record<string, unknown>;
    }>;

    if (!envelope || !envelope.payload) {
      return;
    }

    const { notificationId, channel, payload } = envelope.payload;
    const eventId = envelope.metadata.eventId;

    // In a real scenario, we'd resolve the recipient and message from a template service
    // For now, we use placeholders from the payload or defaults
    const recipient = String(payload?.recipient || payload?.email || payload?.phone || 'placeholder-recipient');
    const message = String(payload?.message || `Notification for ${notificationId}`);

    await this.deliveryApp.processDelivery({
      eventId,
      notificationId,
      channel,
      recipient,
      message
    });
  }
}

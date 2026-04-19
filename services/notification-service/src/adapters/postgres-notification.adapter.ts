import type { Notification } from '../domain/notification.js';
import type { NotificationRequest, NotificationRequestStatus } from '../domain/notification-request.js';

export class PostgresNotificationAdapter {
  private readonly notifications = new Map<string, Notification>();

  private readonly notificationRequests = new Map<string, NotificationRequest>();

  private readonly notificationByEventTemplate = new Map<string, string>();
  private readonly notificationByOutcomeKey = new Map<string, string>();

  async insertNotification(notification: Notification): Promise<void> {
    this.notifications.set(notification.notificationId, notification);
  }

  async findNotificationById(notificationId: string): Promise<Notification | null> {
    return this.notifications.get(notificationId) ?? null;
  }

  async createNotificationRequest(notification: NotificationRequest): Promise<void> {
    this.notificationRequests.set(notification.notificationId, notification);
    this.notificationByEventTemplate.set(
      this.toEventTemplateKey(notification.eventId, notification.templateKey),
      notification.notificationId
    );

    const outcomeKey = this.toOutcomeKey(notification.entityType, notification.entityId, notification.templateKey);
    this.notificationByOutcomeKey.set(outcomeKey, notification.notificationId);
  }

  async findNotificationBySourceEventAndTemplate(
    sourceEventId: string,
    templateKey: string
  ): Promise<NotificationRequest | null> {
    const notificationId = this.notificationByEventTemplate.get(
      this.toEventTemplateKey(sourceEventId, templateKey)
    );

    if (!notificationId) {
      return null;
    }

    return this.notificationRequests.get(notificationId) ?? null;
  }

  async getNotificationById(notificationId: string): Promise<NotificationRequest | null> {
    return this.notificationRequests.get(notificationId) ?? null;
  }

  async findNotificationByOutcome(
    entityType: NotificationRequest['entityType'],
    entityId: string,
    templateKey: string
  ): Promise<NotificationRequest | null> {
    const notificationId = this.notificationByOutcomeKey.get(
      this.toOutcomeKey(entityType, entityId, templateKey)
    );

    if (!notificationId) {
      return null;
    }

    return this.notificationRequests.get(notificationId) ?? null;
  }

  private toEventTemplateKey(sourceEventId: string, templateKey: string): string {
    return `${sourceEventId}:${templateKey}`;
  }

  private toOutcomeKey(
    entityType: NotificationRequest['entityType'],
    entityId: string,
    templateKey: string
  ): string {
    return `${entityType}:${entityId}:${templateKey}`;
  }
  
  async updateNotificationStatus(notificationId: string, status: NotificationRequestStatus): Promise<void> {
    const request = this.notificationRequests.get(notificationId);
    if (request) {
      this.notificationRequests.set(notificationId, {
        ...request,
        status,
        updatedAt: new Date().toISOString()
      });
    }
  }

  async incrementDeliveryAttempt(notificationId: string): Promise<void> {
    const request = this.notificationRequests.get(notificationId);
    if (request) {
      this.notificationRequests.set(notificationId, {
        ...request,
        deliveryAttemptCount: request.deliveryAttemptCount + 1,
        updatedAt: new Date().toISOString()
      });
    }
  }

  private readonly processedEvents = new Set<string>();

  async hasProcessedNotificationDeliveryEvent(eventId: string): Promise<boolean> {
    return this.processedEvents.has(eventId);
  }

  async markNotificationDeliveryEventProcessed(eventId: string): Promise<void> {
    this.processedEvents.add(eventId);
  }
}

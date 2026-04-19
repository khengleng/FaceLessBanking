import type { Notification } from '../../domain/notification.js';

export type CreateNotificationRequestDto = {
  channel: string;
  recipient: string;
  message: string;
};

export type NotificationResponseDto = {
  notificationId: string;
  channel: string;
  recipient: string;
  message: string;
  status: string;
  providerMessageId: string;
  createdAt: string;
};

export function toNotificationResponseDto(notification: Notification): NotificationResponseDto {
  return {
    notificationId: notification.notificationId,
    channel: notification.channel,
    recipient: notification.recipient,
    message: notification.message,
    status: notification.status,
    providerMessageId: notification.providerMessageId,
    createdAt: notification.createdAt
  };
}

export const supportedChannels = ['sms', 'email', 'push'] as const;

export type NotificationChannel = (typeof supportedChannels)[number];
export type NotificationStatus = 'requested';

export type Notification = {
  notificationId: string;
  channel: NotificationChannel;
  recipient: string;
  message: string;
  status: NotificationStatus;
  providerMessageId: string;
  createdAt: string;
};

export type NewNotification = {
  notificationId: string;
  channel: NotificationChannel;
  recipient: string;
  message: string;
  providerMessageId: string;
  createdAt: string;
};

export function buildNotification(input: NewNotification): Notification {
  return {
    notificationId: input.notificationId,
    channel: input.channel,
    recipient: input.recipient,
    message: input.message,
    status: 'requested',
    providerMessageId: input.providerMessageId,
    createdAt: input.createdAt
  };
}

export function isNotificationChannel(value: string): value is NotificationChannel {
  return supportedChannels.includes(value as NotificationChannel);
}

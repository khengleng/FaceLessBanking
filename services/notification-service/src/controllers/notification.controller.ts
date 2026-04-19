import type { FastifyReply, FastifyRequest } from 'fastify';

import type { NotificationApplication } from '../application/notification.application.js';
import type { CreateNotificationRequestDto } from './dtos/notification.dto.js';
import { toNotificationResponseDto } from './dtos/notification.dto.js';

type CreateNotificationRequest = FastifyRequest<{ Body: CreateNotificationRequestDto }>;
type GetNotificationRequest = FastifyRequest<{ Params: { notificationId: string } }>;

export function buildNotificationController(notificationApplication: NotificationApplication) {
  async function createNotification(
    request: CreateNotificationRequest,
    reply: FastifyReply
  ): Promise<void> {
    const result = await notificationApplication.createNotification(request.body);

    if (result.kind === 'invalid_payload') {
      reply.code(400).send({
        error: 'validation_failed',
        details: result.errors
      });
      return;
    }

    if (result.kind === 'invalid_channel') {
      reply.code(400).send({
        error: 'invalid_channel',
        channel: result.channel,
        supportedChannels: ['sms', 'email', 'push']
      });
      return;
    }

    reply.code(201).send(toNotificationResponseDto(result.notification));
  }

  async function getNotificationById(
    request: GetNotificationRequest,
    reply: FastifyReply
  ): Promise<void> {
    const result = await notificationApplication.getNotificationById(request.params.notificationId);

    if (result.kind === 'not_found') {
      reply.code(404).send({ error: 'notification_not_found' });
      return;
    }

    reply.code(200).send(toNotificationResponseDto(result.notification));
  }

  return {
    createNotification,
    getNotificationById
  };
}

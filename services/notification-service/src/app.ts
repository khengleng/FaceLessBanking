import Fastify, { type FastifyInstance } from 'fastify';

import { buildNotificationApplication } from './application/build-notification.application.js';
import { getHealth } from './controllers/health.controller.js';
import { buildNotificationController } from './controllers/notification.controller.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  const notificationApplication = buildNotificationApplication();
  const notificationController = buildNotificationController(notificationApplication);

  app.get('/health', getHealth);
  app.post('/notifications', notificationController.createNotification);
  app.get('/notifications/:notificationId', notificationController.getNotificationById);

  return app;
}

import Fastify, { type FastifyInstance } from 'fastify';

import { buildSupportCrmApplication } from './application/build-support-crm.application.js';
import { getHealth } from './controllers/health.controller.js';
import { buildSupportCrmController } from './controllers/support-crm.controller.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  const supportCrmApplication = buildSupportCrmApplication();
  const supportCrmController = buildSupportCrmController(supportCrmApplication);

  app.get('/health', getHealth);
  app.post('/support/tickets', supportCrmController.createTicket);
  app.get('/support/tickets/:ticketId', supportCrmController.getTicket);
  app.post('/support/tickets/:ticketId/messages', supportCrmController.addMessage);

  return app;
}

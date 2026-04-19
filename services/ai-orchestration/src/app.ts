import Fastify, { type FastifyInstance } from 'fastify';

import { buildAiApplication } from './application/build-ai.application.js';
import { buildAiController } from './controllers/ai.controller.js';
import { getHealth } from './controllers/health.controller.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  const aiApplication = buildAiApplication();
  const aiController = buildAiController(aiApplication);

  app.get('/health', getHealth);
  app.post('/ai/chat', aiController.chat);
  app.post('/ai/summarize', aiController.summarize);
  app.post('/ai/classify', aiController.classify);

  return app;
}

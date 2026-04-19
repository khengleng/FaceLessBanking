import Fastify, { type FastifyInstance } from 'fastify';

import { PostgresEkycAdapter } from './adapters/postgres-ekyc.adapter.js';
import { AmlProviderAdapterStub } from './adapters/provider-aml.adapter.js';
import { LivenessProviderAdapterStub } from './adapters/provider-liveness.adapter.js';
import { OcrProviderAdapterStub } from './adapters/provider-ocr.adapter.js';
import { DocumentStorageAdapterStub } from './adapters/document-storage.adapter.js';
import { KafkaProducerAdapter } from './adapters/kafka-producer.adapter.js';
import { buildEkycApplicationWithDeps } from './application/build-ekyc.application.js';
import { buildSumsubWebhookApplication } from './application/build-sumsub-webhook.application.js';
import { buildEkycController } from './controllers/ekyc.controller.js';
import { buildSumsubWebhookController } from './controllers/sumsub-webhook.controller.js';
import { getHealth } from './controllers/health.controller.js';
import { EkycEventsPublisher } from './events/ekyc.events.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  const postgresAdapter = new PostgresEkycAdapter();
  const kafkaProducer = new KafkaProducerAdapter();
  const ekycEvents = new EkycEventsPublisher(kafkaProducer);

  const ekycApplication = buildEkycApplicationWithDeps({
    postgresAdapter,
    ocrProvider: new OcrProviderAdapterStub(),
    livenessProvider: new LivenessProviderAdapterStub(),
    amlProvider: new AmlProviderAdapterStub(),
    documentStorage: new DocumentStorageAdapterStub(),
    kafkaProducer,
    ekycEvents
  });
  const webhookApplication = buildSumsubWebhookApplication({
    postgresAdapter,
    eventsPublisher: ekycEvents,
    logger: {
      info: (payload: Record<string, unknown>, message: string): void => {
        console.info(JSON.stringify({ level: 'info', service: 'ekyc-orchestration', message, ...payload }));
      },
      warn: (payload: Record<string, unknown>, message: string): void => {
        console.warn(JSON.stringify({ level: 'warn', service: 'ekyc-orchestration', message, ...payload }));
      },
      error: (payload: Record<string, unknown>, message: string): void => {
        console.error(JSON.stringify({ level: 'error', service: 'ekyc-orchestration', message, ...payload }));
      }
    }
  }).application;
  const ekycController = buildEkycController(ekycApplication);
  const webhookController = buildSumsubWebhookController(webhookApplication);

  app.get('/health', getHealth);
  app.post('/ekyc/sessions', ekycController.createSession);
  app.post('/ekyc/sessions/:sessionId/documents', ekycController.uploadDocuments);
  app.post('/ekyc/sessions/:sessionId/liveness', ekycController.submitLiveness);
  app.get('/ekyc/sessions/:sessionId', ekycController.getSession);
  app.post('/webhooks/sumsub', webhookController.handleWebhook);

  return app;
}

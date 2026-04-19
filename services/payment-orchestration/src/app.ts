import { randomUUID } from 'node:crypto';

import Fastify, { type FastifyInstance } from 'fastify';

import { buildPaymentApplication } from './application/build-payment.application.js';
import type { KafkaProducerAdapter } from './adapters/kafka-producer.adapter.js';
import type { PostgresPaymentAdapter } from './adapters/postgres-payment.adapter.js';
import type { RedisIdempotencyAdapter } from './adapters/redis-idempotency.adapter.js';
import { getHealth } from './controllers/health.controller.js';
import { buildPaymentController } from './controllers/payment.controller.js';

export function createApp(deps?: {
  postgresAdapter?: PostgresPaymentAdapter;
  redisAdapter?: RedisIdempotencyAdapter;
  kafkaProducer?: KafkaProducerAdapter;
}): FastifyInstance {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info'
    }
  });

  const paymentApplication = buildPaymentApplication(deps);
  const paymentController = buildPaymentController(paymentApplication);

  app.addHook('onRequest', async (request, reply) => {
    const rawCorrelationId = request.headers['x-correlation-id'];
    const correlationId =
      typeof rawCorrelationId === 'string' && rawCorrelationId.length > 0
        ? rawCorrelationId
        : randomUUID();

    request.headers['x-correlation-id'] = correlationId;
    reply.header('x-correlation-id', correlationId);
  });

  app.get('/health', getHealth);
  app.post('/payments/internal-transfer', paymentController.initiateInternalTransfer);
  app.get('/payments', paymentController.listPayments);
  app.get('/payments/:paymentId', paymentController.getPaymentById);
  app.post('/beneficiaries', paymentController.createBeneficiary);

  return app;
}

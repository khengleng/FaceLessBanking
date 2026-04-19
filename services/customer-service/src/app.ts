import Fastify, { type FastifyInstance } from 'fastify';
import pg from 'pg';
import { Redis } from 'ioredis';

import { buildCustomerApplication } from './application/build-customer.application.js';
import { buildCustomerProfileApplication } from './application/build-customer-profile.application.js';
import { buildCustomerController } from './controllers/customer.controller.js';
import { getHealth } from './controllers/health.controller.js';
import { KafkaProducerAdapter } from './adapters/kafka-producer.adapter.js';
import type { PostgresClient } from './adapters/postgres-customer.adapter.js';
import type { RedisClient } from './adapters/redis-idempotency.adapter.js';

type AppDepsOverride = {
  db?: PostgresClient;
  redis?: RedisClient;
  kafkaProducer?: KafkaProducerAdapter;
};

export function createApp(depsOverride?: AppDepsOverride): FastifyInstance {
  const app = Fastify({ logger: false });

  // Initialize real clients if not overridden (e.g., in production)
  const db = depsOverride?.db ?? new pg.Pool({
    connectionString: process.env.DATABASE_URL
  });
  const redis = depsOverride?.redis ?? new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  const kafkaProducer = depsOverride?.kafkaProducer ?? new KafkaProducerAdapter();

  const customerApplication = buildCustomerApplication({
    db,
    redis,
    kafkaProducer
  });
  const customerProfileApplication = buildCustomerProfileApplication({ db });
  const customerController = buildCustomerController(customerApplication, customerProfileApplication);

  app.get('/health', getHealth);
  app.post('/customers', customerController.createCustomer);
  app.get('/customers', customerController.listCustomers);
  app.get('/customers/:customerId', customerController.getCustomerById);
  app.get('/customers/:customerId/profile', customerController.getCustomerProfile);
  app.patch('/customers/:customerId/profile', customerController.patchCustomerProfile);

  return app;
}

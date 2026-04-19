import Fastify, { type FastifyInstance } from 'fastify';

import {
  InMemoryAlmEngineAdapter,
  InMemoryKafkaProfitabilityAdapter,
  InMemoryPostgresProfitabilityAdapter
} from './adapters/profitability-adapters.js';
import { ProfitabilityApplication } from './application/profitability.application.js';
import { buildProfitabilityController } from './controllers/profitability.controller.js';
import { ProfitabilityConsumer } from './events/profitability-consumer.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  const postgresAdapter = new InMemoryPostgresProfitabilityAdapter();
  const kafkaAdapter = new InMemoryKafkaProfitabilityAdapter();
  const almAdapter = new InMemoryAlmEngineAdapter();
  const application = new ProfitabilityApplication(postgresAdapter, kafkaAdapter, almAdapter, app.log);
  const controller = buildProfitabilityController(application);

  const consumer = new ProfitabilityConsumer(application, app.log);
  void consumer.start();

  app.get('/health', async () => ({ status: 'OK' }));
  app.get('/profitability/records', controller.listRevenueCostRecords);
  app.get('/profitability/customers/:customerId', controller.getCustomerProfitability);
  app.get('/profitability/products/:productType', controller.getProductProfitability);
  app.get('/profitability/pnl', controller.getBankPnL);
  app.get('/profitability/margins', controller.getMarginMetrics);

  return app;
}

import Fastify, { type FastifyInstance } from 'fastify';

import {
  AllowAllWorkflowAdapter,
  InMemoryAccountingAdapter,
  InMemoryBalanceAdapter,
  InMemoryKafkaTradeFinanceAdapter,
  InMemoryPostgresTradeFinanceAdapter
} from './adapters/trade-finance.adapters.js';
import { TradeFinanceApplication } from './application/trade-finance.application.js';
import { buildTradeFinanceController } from './controllers/trade-finance.controller.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  const postgres = new InMemoryPostgresTradeFinanceAdapter();
  const workflow = new AllowAllWorkflowAdapter();
  const accounting = new InMemoryAccountingAdapter();
  const balance = new InMemoryBalanceAdapter();
  const kafka = new InMemoryKafkaTradeFinanceAdapter();

  const application = new TradeFinanceApplication(postgres, workflow, accounting, balance, kafka, app.log);
  const controller = buildTradeFinanceController(application);

  app.get('/health', async () => ({ status: 'OK' }));
  app.post('/trade/lc', controller.postLC);
  app.get('/trade/lc/:lcId', controller.getLC);
  app.post('/trade/lc/:lcId/approve', controller.approveLC);
  app.post('/trade/lc/:lcId/issue', controller.issueLC);
  app.post('/trade/lc/:lcId/settle', controller.settleLC);

  return app;
}

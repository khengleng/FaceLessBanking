import Fastify, { type FastifyInstance } from 'fastify';
import { LiquidityApplication } from './application/liquidity.application.js';
import { PostgresLiquidityAdapter } from './adapters/postgres-liquidity.adapter.js';
import { buildLiquidityController } from './controllers/liquidity.controller.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  const postgresAdapter = new PostgresLiquidityAdapter();
  const application = new LiquidityApplication(postgresAdapter, app.log);
  const controller = buildLiquidityController(application);

  app.get('/health', async () => ({ status: 'OK' }));
  
  app.get('/liquidity/positions', controller.getPositions);
  app.get('/liquidity/positions/:currency', controller.getPositionByCurrency);
  app.get('/liquidity/summary', controller.getSummary);

  return app;
}

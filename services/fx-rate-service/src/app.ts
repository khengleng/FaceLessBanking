import Fastify, { type FastifyInstance } from 'fastify';
import { FXApplication } from './application/fx.application.js';
import { InMemoryFXPostgresAdapter, InMemoryFXKafkaAdapter } from './adapters/fx-adapters.js';
import { buildFXController } from './controllers/fx.controller.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  const postgresAdapter = new InMemoryFXPostgresAdapter();
  const kafkaAdapter = new InMemoryFXKafkaAdapter();
  const application = new FXApplication(postgresAdapter, kafkaAdapter, app.log);
  const controller = buildFXController(application);

  app.get('/health', async () => ({ status: 'OK' }));
  
  app.post('/fx/currencies', controller.postCurrency);
  app.get('/fx/currencies/:currencyCode', controller.getCurrency);
  
  app.post('/fx/rates', controller.postFxRate);
  app.get('/fx/rates/latest', controller.getLatestFxRate);
  app.get('/fx/rates/history', controller.getFxRateHistory);

  return app;
}

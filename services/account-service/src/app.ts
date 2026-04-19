import Fastify, { type FastifyInstance } from 'fastify';

import { PostgresAccountAdapter } from './adapters/postgres-account.adapter.js';
import { RedisIdempotencyAdapter } from './adapters/redis-idempotency.adapter.js';
import { FineractAdapterStub } from './adapters/fineract.adapter.js';
import { KafkaProducerAdapter } from './adapters/kafka-producer.adapter.js';
import { buildAccountApplication } from './application/build-account.application.js';
import type { AccountActivationApplication } from './application/account-activation.application.js';
import { buildAccountActivationApplication } from './application/build-account-activation.application.js';
import { buildAccountController } from './controllers/account.controller.js';
import { getHealth } from './controllers/health.controller.js';
import { AccountEventsPublisher } from './events/account.events.js';
import { AuditEventsService } from './events/audit.events.js';
import { InterestEventsPublisher } from './events/interest.events.js';
import { buildDepositInterestAccrualApplication } from './application/build-deposit-interest-accrual.application.js';

export function createApp(options?: {
  accountApplication?: ReturnType<typeof buildAccountApplication>;
  accountActivationApplication?: AccountActivationApplication;
}): FastifyInstance {
  const app = Fastify({ logger: false });

  const sharedPostgresAdapter = new PostgresAccountAdapter();
  const sharedRedisAdapter = new RedisIdempotencyAdapter();
  const sharedFineractAdapter = new FineractAdapterStub();
  const sharedKafkaProducer = new KafkaProducerAdapter();
  const sharedAccountEvents = new AccountEventsPublisher(sharedKafkaProducer);
  const sharedAuditEvents = new AuditEventsService();
  const sharedInterestEvents = new InterestEventsPublisher(sharedKafkaProducer);

  const accountApplication = options?.accountApplication ?? buildAccountApplication({
    postgresAdapter: sharedPostgresAdapter,
    redisAdapter: sharedRedisAdapter,
    fineractAdapter: sharedFineractAdapter,
    kafkaProducer: sharedKafkaProducer,
    accountEventsPublisher: sharedAccountEvents,
    auditEventsService: sharedAuditEvents
  });
  const accountActivationApplication = options?.accountActivationApplication
    ?? buildAccountActivationApplication({
      postgresAdapter: sharedPostgresAdapter,
      redisAdapter: sharedRedisAdapter,
      accountEvents: sharedAccountEvents,
      auditEvents: sharedAuditEvents
    }).application;
    
  const interestAccrualApplication = buildDepositInterestAccrualApplication({
    postgresAdapter: sharedPostgresAdapter,
    interestEvents: sharedInterestEvents
  }).application;

  const accountController = buildAccountController(
    accountApplication, 
    accountActivationApplication,
    interestAccrualApplication
  );

  app.get('/health', getHealth);
  app.post('/accounts', accountController.createAccount);
  app.get('/accounts', accountController.listAccounts);
  app.get('/accounts/:accountId', accountController.getAccountById);
  app.get('/accounts/:accountId/balance', accountController.getAccountBalance);
  app.post('/accounts/:accountId/activate', accountController.activateAccount);
  app.post('/accounts/interest/accrue', accountController.accrueInterest);

  return app;
}

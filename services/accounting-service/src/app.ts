import Fastify from 'fastify';
import type { Pool } from 'pg';
import type { Producer } from 'kafkajs';
import { PostgresAccountingAdapter } from './adapters/postgres-accounting.adapter.js';
import { AccountingEventsPublisher } from './events/accounting.events.js';
import { AccountingApplication } from './application/accounting.application.js';
import { buildAccountingController } from './controllers/accounting.controller.js';

export function buildApp(params: {
  dbPool: Pool;
  kafkaProducer: Producer;
}) {
  const app = Fastify({ logger: true });

  const postgresAdapter = new PostgresAccountingAdapter(params.dbPool);
  const eventsPublisher = new AccountingEventsPublisher(params.kafkaProducer);
  
  const accountingApplication = new AccountingApplication(
    postgresAdapter,
    eventsPublisher,
    app.log
  );

  const controller = buildAccountingController(accountingApplication);

  app.get('/health', controller.health);
  app.post('/accounting/journals', controller.createManualJournal);
  app.get('/accounting/journals/:journalId', controller.getJournalById);

  return { app, accountingApplication };
}

import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { PaymentAdapterStub } from '../adapters/payment.adapter.js';
import { PostgresLoanAdapter } from '../adapters/postgres-loan.adapter.js';
import { RedisIdempotencyAdapter } from '../adapters/redis-idempotency.adapter.js';
import { RulesEngineAdapterStub } from '../adapters/rules-engine.adapter.js';
import { AuditEventsService } from '../events/audit.events.js';
import { LoanEventsPublisher } from '../events/loan.events.js';

import { LoanApplication } from './loan.application.js';

export function buildLoanApplication(): LoanApplication {
  const postgresAdapter = new PostgresLoanAdapter();
  const redisIdempotencyAdapter = new RedisIdempotencyAdapter();
  const paymentAdapter = new PaymentAdapterStub();
  const rulesEngineAdapter = new RulesEngineAdapterStub();
  const kafkaProducer = new KafkaProducerAdapter();
  const auditEvents = new AuditEventsService();
  const loanEvents = new LoanEventsPublisher(kafkaProducer);

  return new LoanApplication(
    postgresAdapter,
    redisIdempotencyAdapter,
    paymentAdapter,
    rulesEngineAdapter,
    auditEvents,
    loanEvents,
    process.env.LOAN_FUNDING_ACCOUNT_ID ?? 'loan-funding-account'
  );
}

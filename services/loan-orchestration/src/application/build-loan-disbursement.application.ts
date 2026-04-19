import { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import { PaymentAdapterStub, type PaymentAdapter } from '../adapters/payment.adapter.js';
import type { PostgresLoanAdapter } from '../adapters/postgres-loan.adapter.js';
import { LoanDisbursementConsumer } from '../events/loan-disbursement.consumer.js';
import type { LoanEventsPublisher } from '../events/loan.events.js';
import { LoanDisbursementMetrics } from '../events/metrics.js';

import { LoanDisbursementApplication } from './loan-disbursement.application.js';

export function buildLoanDisbursementApplication(deps: {
  postgresAdapter: PostgresLoanAdapter;
  loanEvents: LoanEventsPublisher;
  paymentAdapter?: PaymentAdapter;
  metrics?: LoanDisbursementMetrics;
  kafkaConsumer?: KafkaConsumerAdapter;
  fundingAccountId?: string;
  logger?: {
    info: (payload: Record<string, unknown>, message: string) => void;
    warn: (payload: Record<string, unknown>, message: string) => void;
    error: (payload: Record<string, unknown>, message: string) => void;
  };
}): {
  application: LoanDisbursementApplication;
  consumer: LoanDisbursementConsumer;
  paymentAdapter: PaymentAdapter;
  metrics: LoanDisbursementMetrics;
} {
  const logger = deps.logger ?? {
    info: (payload: Record<string, unknown>, message: string): void => {
      void payload;
      void message;
    },
    warn: (payload: Record<string, unknown>, message: string): void => {
      void payload;
      void message;
    },
    error: (payload: Record<string, unknown>, message: string): void => {
      void payload;
      void message;
    }
  };

  const paymentAdapter = deps.paymentAdapter ?? new PaymentAdapterStub();
  const metrics = deps.metrics ?? new LoanDisbursementMetrics();
  const application = new LoanDisbursementApplication(
    deps.postgresAdapter,
    paymentAdapter,
    deps.loanEvents,
    metrics,
    logger,
    deps.fundingAccountId ?? 'bank-funding-account'
  );

  const consumer = new LoanDisbursementConsumer(
    deps.kafkaConsumer ?? new KafkaConsumerAdapter(),
    application
  );

  return {
    application,
    consumer,
    paymentAdapter,
    metrics
  };
}

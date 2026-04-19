import { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import type { PostgresLoanAdapter } from '../adapters/postgres-loan.adapter.js';
import { LoanScheduleConsumer } from '../events/loan-schedule.consumer.js';
import type { LoanEventsPublisher } from '../events/loan.events.js';
import { LoanScheduleMetrics } from '../events/metrics.js';

import { LoanScheduleApplication } from './loan-schedule.application.js';

export function buildLoanScheduleApplication(deps: {
  postgresAdapter: PostgresLoanAdapter;
  loanEvents: LoanEventsPublisher;
  annualInterestRateBps?: number;
  metrics?: LoanScheduleMetrics;
  kafkaConsumer?: KafkaConsumerAdapter;
  logger?: {
    info: (payload: Record<string, unknown>, message: string) => void;
    warn: (payload: Record<string, unknown>, message: string) => void;
    error: (payload: Record<string, unknown>, message: string) => void;
  };
}): {
  application: LoanScheduleApplication;
  consumer: LoanScheduleConsumer;
  metrics: LoanScheduleMetrics;
} {
  const metrics = deps.metrics ?? new LoanScheduleMetrics();
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

  const application = new LoanScheduleApplication(
    deps.postgresAdapter,
    deps.loanEvents,
    metrics,
    logger,
    deps.annualInterestRateBps ?? 1200
  );

  const consumer = new LoanScheduleConsumer(
    deps.kafkaConsumer ?? new KafkaConsumerAdapter(),
    application
  );

  return {
    application,
    consumer,
    metrics
  };
}

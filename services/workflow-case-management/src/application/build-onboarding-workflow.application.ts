import { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import { PostgresCaseAdapter } from '../adapters/postgres-case.adapter.js';
import { OnboardingWorkflowConsumer } from '../events/onboarding-workflow.consumer.js';
import { OnboardingWorkflowMetrics } from '../events/metrics.js';
import { CaseEventsPublisher } from '../events/case.events.js';
import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';

import { OnboardingWorkflowApplication } from './onboarding-workflow.application.js';

export function buildOnboardingWorkflowApplication(deps: {
  postgresAdapter?: PostgresCaseAdapter;
  eventsPublisher?: CaseEventsPublisher;
  kafkaConsumer?: KafkaConsumerAdapter;
  metrics?: OnboardingWorkflowMetrics;
  logger?: {
    info: (payload: Record<string, unknown>, message: string) => void;
    warn: (payload: Record<string, unknown>, message: string) => void;
    error: (payload: Record<string, unknown>, message: string) => void;
  };
} = {}): {
  application: OnboardingWorkflowApplication;
  consumer: OnboardingWorkflowConsumer;
  metrics: OnboardingWorkflowMetrics;
} {
  const postgresAdapter = deps.postgresAdapter ?? new PostgresCaseAdapter();
  const eventsPublisher = deps.eventsPublisher ?? new CaseEventsPublisher(new KafkaProducerAdapter());
  const kafkaConsumer = deps.kafkaConsumer ?? new KafkaConsumerAdapter();
  const metrics = deps.metrics ?? new OnboardingWorkflowMetrics();

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

  const application = new OnboardingWorkflowApplication(
    postgresAdapter,
    eventsPublisher,
    metrics,
    logger
  );

  const consumer = new OnboardingWorkflowConsumer(kafkaConsumer, application);

  return {
    application,
    consumer,
    metrics
  };
}

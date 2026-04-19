import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { PostgresCaseAdapter } from '../adapters/postgres-case.adapter.js';
import { CaseEventsPublisher } from '../events/case.events.js';
import { ManualReviewQueueMetrics } from '../events/metrics.js';

import { WorkflowCaseManagementApplication } from './workflow-case-management.application.js';

export function buildWorkflowCaseManagementApplication(deps: {
  postgresAdapter?: PostgresCaseAdapter;
  kafkaProducer?: KafkaProducerAdapter;
  eventsPublisher?: CaseEventsPublisher;
} = {}): WorkflowCaseManagementApplication {
  const postgresAdapter = deps.postgresAdapter ?? new PostgresCaseAdapter();
  const kafkaProducer = deps.kafkaProducer ?? new KafkaProducerAdapter();
  const eventsPublisher = deps.eventsPublisher ?? new CaseEventsPublisher(kafkaProducer);
  const metrics = new ManualReviewQueueMetrics();

  return new WorkflowCaseManagementApplication(postgresAdapter, eventsPublisher, metrics);
}

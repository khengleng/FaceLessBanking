import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { PostgresSupportAdapter } from '../adapters/postgres-support.adapter.js';
import { SupportEventsPublisher } from '../events/support.events.js';

import { SupportCrmApplication } from './support-crm.application.js';

export function buildSupportCrmApplication(): SupportCrmApplication {
  const postgresAdapter = new PostgresSupportAdapter();
  const kafkaProducer = new KafkaProducerAdapter();
  const eventsPublisher = new SupportEventsPublisher(kafkaProducer);

  return new SupportCrmApplication(postgresAdapter, eventsPublisher);
}

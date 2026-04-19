import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { PostgresRiskAdapter } from '../adapters/postgres-risk.adapter.js';
import { RiskEventsPublisher } from '../events/risk.events.js';

import { FraudRiskEngineApplication } from './fraud-risk-engine.application.js';

export function buildFraudRiskEngineApplication(): FraudRiskEngineApplication {
  const postgresAdapter = new PostgresRiskAdapter();
  const kafkaProducer = new KafkaProducerAdapter();
  const eventsPublisher = new RiskEventsPublisher(kafkaProducer);

  return new FraudRiskEngineApplication(postgresAdapter, eventsPublisher);
}

import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { PostgresAuditAdapter } from '../adapters/postgres-audit.adapter.js';

import { AuditApplication } from './audit.application.js';

export function buildAuditApplication(): AuditApplication {
  return new AuditApplication(new PostgresAuditAdapter(), new KafkaProducerAdapter());
}

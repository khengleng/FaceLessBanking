import type { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import type { RiskAlert } from '../domain/risk-alert.js';
import type { RiskScore } from '../domain/risk-score.js';

export class RiskEventsPublisher {
  constructor(private readonly kafkaProducer: KafkaProducerAdapter) {}

  async emitRiskScored(score: RiskScore): Promise<void> {
    await this.kafkaProducer.publish({
      eventName: 'risk.scored',
      aggregateId: score.scoreId,
      occurredAt: new Date().toISOString(),
      payload: {
        riskType: score.riskType,
        score: score.score,
        level: score.level
      }
    });
  }

  async emitRiskAlertCreated(alert: RiskAlert): Promise<void> {
    await this.kafkaProducer.publish({
      eventName: 'risk.alert.created',
      aggregateId: alert.alertId,
      occurredAt: new Date().toISOString(),
      payload: {
        alertId: alert.alertId,
        riskType: alert.riskType,
        severity: alert.severity,
        status: alert.status
      }
    });
  }
}

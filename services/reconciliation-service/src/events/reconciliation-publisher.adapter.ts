import { randomUUID } from 'node:crypto';
import type { 
  ReconciliationJob, 
  ReconciliationMismatch 
} from '../domain/reconciliation-job.js';

type KafkaProducer = {
  send: (input: { topic: string; messages: Array<{ key: string; value: string }> }) => Promise<void>;
};

export class ReconciliationEventsPublisher {
  constructor(private readonly kafkaProducer: KafkaProducer) {}

  async emitJobStarted(job: ReconciliationJob, correlationId?: string): Promise<void> {
    const event = {
      specVersion: '1.0',
      type: 'reconciliation.job.started.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: correlationId || randomUUID(),
        timestamp: new Date().toISOString(),
        producer: 'reconciliation-service'
      },
      payload: {
        jobId: job.jobId,
        jobType: job.jobType,
        status: job.status,
        timestamp: job.startedAt || new Date().toISOString()
      }
    };

    await this.kafkaProducer.send({
      topic: 'reconciliation.job.started.v1',
      messages: [{ key: job.jobId, value: JSON.stringify(event) }]
    });
  }

  async emitJobCompleted(
    job: ReconciliationJob, 
    mismatchCount: number, 
    correlationId?: string
  ): Promise<void> {
    const event = {
      specVersion: '1.0',
      type: 'reconciliation.job.completed.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: correlationId || randomUUID(),
        timestamp: new Date().toISOString(),
        producer: 'reconciliation-service'
      },
      payload: {
        jobId: job.jobId,
        jobType: job.jobType,
        status: job.status,
        mismatchCount,
        timestamp: job.completedAt || new Date().toISOString()
      }
    };

    await this.kafkaProducer.send({
      topic: 'reconciliation.job.completed.v1',
      messages: [{ key: job.jobId, value: JSON.stringify(event) }]
    });
  }

  async emitMismatchDetected(mismatch: ReconciliationMismatch, correlationId?: string): Promise<void> {
    const event = {
      specVersion: '1.0',
      type: 'reconciliation.mismatch.detected.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: correlationId || randomUUID(),
        timestamp: new Date().toISOString(),
        producer: 'reconciliation-service'
      },
      payload: {
        mismatchId: mismatch.mismatchId,
        jobId: mismatch.jobId,
        entityType: mismatch.entityType,
        entityId: mismatch.entityId,
        expectedValue: mismatch.expectedValue,
        actualValue: mismatch.actualValue,
        mismatchType: mismatch.mismatchType,
        timestamp: mismatch.createdAt
      }
    };

    await this.kafkaProducer.send({
      topic: 'reconciliation.mismatch.detected.v1',
      messages: [{ key: mismatch.entityId, value: JSON.stringify(event) }]
    });
  }
}

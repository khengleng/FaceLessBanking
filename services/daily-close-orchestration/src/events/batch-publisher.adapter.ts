import type { Producer } from 'kafkajs';
import { randomUUID } from 'node:crypto';
import type { DailyCloseRun } from '../domain/batch.js';

export class BatchEventsPublisher {
  private readonly startedTopic = 'daily.close.started.v1';
  private readonly completedTopic = 'daily.close.completed.v1';

  constructor(
    private readonly producer: Producer,
    private readonly source: string = 'daily-close-orchestration'
  ) {}

  async emitDailyCloseStarted(run: DailyCloseRun, correlationId?: string): Promise<void> {
    const event = {
      specVersion: '1.0',
      type: 'daily.close.started.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: correlationId || randomUUID(),
        timestamp: new Date().toISOString(),
        producer: this.source
      },
      payload: {
        runId: run.runId,
        businessDate: run.businessDate,
        status: run.status,
        timestamp: run.startedAt
      }
    };

    await this.producer.send({
      topic: this.startedTopic,
      messages: [{ key: run.runId, value: JSON.stringify(event) }]
    });
  }

  async emitDailyCloseCompleted(run: DailyCloseRun, correlationId?: string): Promise<void> {
    const event = {
      specVersion: '1.0',
      type: 'daily.close.completed.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: correlationId || randomUUID(),
        timestamp: new Date().toISOString(),
        producer: this.source
      },
      payload: {
        runId: run.runId,
        businessDate: run.businessDate,
        status: run.status,
        timestamp: run.completedAt || new Date().toISOString()
      }
    };

    await this.producer.send({
      topic: this.completedTopic,
      messages: [{ key: run.runId, value: JSON.stringify(event) }]
    });
  }
}

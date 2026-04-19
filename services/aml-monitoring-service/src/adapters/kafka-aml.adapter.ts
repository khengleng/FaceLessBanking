import type { AMLAlert } from '../domain/aml-alert.js';

export type PublishedAmlEvent = {
  type: 'aml.alert.v1';
  metadata: {
    eventId: string;
    correlationId: string;
    timestamp: string;
    producer: string;
  };
  payload: {
    alertId: string;
    sourceEventId: string;
    entityType: string;
    entityId: string;
    ruleName: string;
    severity: string;
    status: string;
    reason: string;
    createdAt: string;
  };
};

export class KafkaAmlAdapter {
  private paymentEventHandler: ((event: unknown) => Promise<void>) | null = null;

  readonly publishedEvents: PublishedAmlEvent[] = [];

  async subscribePaymentEvents(handler: (event: unknown) => Promise<void>): Promise<void> {
    this.paymentEventHandler = handler;
  }

  async publishAmlAlert(input: {
    alert: AMLAlert;
    correlationId: string;
  }): Promise<void> {
    this.publishedEvents.push({
      type: 'aml.alert.v1',
      metadata: {
        eventId: `evt-${input.alert.alertId}`,
        correlationId: input.correlationId,
        timestamp: new Date().toISOString(),
        producer: 'aml-monitoring-service'
      },
      payload: {
        alertId: input.alert.alertId,
        sourceEventId: input.alert.sourceEventId,
        entityType: input.alert.entityType,
        entityId: input.alert.entityId,
        ruleName: input.alert.ruleName,
        severity: input.alert.severity,
        status: input.alert.status,
        reason: input.alert.reason,
        createdAt: input.alert.createdAt
      }
    });
  }

  async handlePaymentEvent(event: unknown): Promise<void> {
    if (this.paymentEventHandler) {
      await this.paymentEventHandler(event);
    }
  }
}

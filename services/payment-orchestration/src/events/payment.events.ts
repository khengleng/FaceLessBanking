import { randomUUID } from 'node:crypto';

import { buildEventEnvelope } from '@faceless-banking/shared-events';

import type {
  KafkaProducerAdapter,
  PaymentInitiatedEvent,
  PaymentStatusUpdatedEvent
} from '../adapters/kafka-producer.adapter.js';
import type { Payment } from '../domain/payment.js';

export class PaymentEventsPublisher {
  constructor(private readonly kafkaProducer: KafkaProducerAdapter) {}

  async emitPaymentInitiated(payment: Payment): Promise<{ published: boolean }> {
    const event: PaymentInitiatedEvent = buildEventEnvelope({
      type: 'payment.initiated.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: payment.correlationId,
        causationId: payment.idempotencyKey,
        timestamp: new Date().toISOString(),
        producer: 'payment-orchestration'
      },
      payload: {
        paymentId: payment.paymentId,
        sourceAccountId: payment.sourceAccountId,
        destinationAccountId: payment.destinationAccountId,
        amount: payment.amount,
        currency: payment.currency,
        channel: payment.channel
      }
    });

    return this.kafkaProducer.publishPaymentInitiated(event);
  }

  async emitPaymentStatusUpdated(input: {
    paymentId: string;
    sourceAccountId: string;
    destinationAccountId: string;
    amount: number;
    currency: string;
    previousStatus: string;
    status: string;
    correlationId: string;
    eventId: string;
    reason: string;
  }): Promise<{ published: boolean }> {
    const event: PaymentStatusUpdatedEvent = buildEventEnvelope({
      type: 'payment.status.updated.v1',
      version: 1,
      metadata: {
        eventId: randomUUID(),
        correlationId: input.correlationId,
        causationId: input.eventId,
        timestamp: new Date().toISOString(),
        producer: 'payment-orchestration'
      },
      payload: {
        paymentId: input.paymentId,
        sourceAccountId: input.sourceAccountId,
        destinationAccountId: input.destinationAccountId,
        amount: input.amount,
        currency: input.currency,
        previousStatus: input.previousStatus,
        status: input.status,
        reason: input.reason
      }
    });

    return this.kafkaProducer.publishPaymentStatusUpdated(event);
  }
}

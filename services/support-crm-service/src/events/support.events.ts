import type { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import type { SupportTicket } from '../domain/support-ticket.js';
import type { TicketMessage } from '../domain/ticket-message.js';

export class SupportEventsPublisher {
  constructor(private readonly kafkaProducer: KafkaProducerAdapter) {}

  async emitSupportTicketCreated(ticket: SupportTicket): Promise<void> {
    await this.kafkaProducer.publish({
      eventName: 'support.ticket.created',
      aggregateId: ticket.ticketId,
      occurredAt: new Date().toISOString(),
      payload: {
        ticketId: ticket.ticketId,
        customerId: ticket.customerId,
        status: ticket.status
      }
    });
  }

  async emitSupportMessageAdded(message: TicketMessage): Promise<void> {
    await this.kafkaProducer.publish({
      eventName: 'support.message.added',
      aggregateId: message.ticketId,
      occurredAt: new Date().toISOString(),
      payload: {
        ticketId: message.ticketId,
        messageId: message.messageId,
        senderType: message.senderType
      }
    });
  }
}

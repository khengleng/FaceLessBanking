import { randomUUID } from 'node:crypto';

import type { PostgresSupportAdapter } from '../adapters/postgres-support.adapter.js';
import type {
  AddTicketMessageRequestDto,
  CreateSupportTicketRequestDto
} from '../controllers/dtos/support.dto.js';
import { buildSupportTicket, type SupportTicket } from '../domain/support-ticket.js';
import { buildTicketMessage, type TicketMessage } from '../domain/ticket-message.js';
import type { SupportEventsPublisher } from '../events/support.events.js';

export type CreateTicketResult =
  | { kind: 'created'; ticket: SupportTicket; messages: TicketMessage[] }
  | { kind: 'invalid_payload'; errors: string[] };

export type GetTicketResult =
  | { kind: 'found'; ticket: SupportTicket; messages: TicketMessage[] }
  | { kind: 'not_found' };

export type AddMessageResult =
  | { kind: 'added'; ticket: SupportTicket; message: TicketMessage; messages: TicketMessage[] }
  | { kind: 'invalid_payload'; errors: string[] }
  | { kind: 'ticket_not_found' };

export class SupportCrmApplication {
  constructor(
    private readonly postgresAdapter: PostgresSupportAdapter,
    private readonly eventsPublisher: SupportEventsPublisher
  ) {}

  async createTicket(payload: CreateSupportTicketRequestDto): Promise<CreateTicketResult> {
    const errors = validateCreateTicketPayload(payload);
    if (errors.length > 0) {
      return { kind: 'invalid_payload', errors };
    }

    const now = new Date().toISOString();
    const ticket = buildSupportTicket({
      ticketId: randomUUID(),
      customerId: payload.customerId,
      subject: payload.subject,
      createdAt: now
    });

    await this.postgresAdapter.insertTicket(ticket);
    await this.eventsPublisher.emitSupportTicketCreated(ticket);

    return { kind: 'created', ticket, messages: [] };
  }

  async getTicket(ticketId: string): Promise<GetTicketResult> {
    const ticket = await this.postgresAdapter.findTicketById(ticketId);

    if (!ticket) {
      return { kind: 'not_found' };
    }

    const messages = await this.postgresAdapter.findMessagesByTicketId(ticketId);

    return { kind: 'found', ticket, messages };
  }

  async addMessage(ticketId: string, payload: AddTicketMessageRequestDto): Promise<AddMessageResult> {
    const errors = validateAddMessagePayload(payload);
    if (errors.length > 0) {
      return { kind: 'invalid_payload', errors };
    }

    const ticket = await this.postgresAdapter.findTicketById(ticketId);
    if (!ticket) {
      return { kind: 'ticket_not_found' };
    }

    const message = buildTicketMessage({
      messageId: randomUUID(),
      ticketId,
      senderType: payload.senderType,
      message: payload.message,
      createdAt: new Date().toISOString()
    });

    await this.postgresAdapter.appendTicketMessage(message);
    await this.eventsPublisher.emitSupportMessageAdded(message);

    const messages = await this.postgresAdapter.findMessagesByTicketId(ticketId);

    return { kind: 'added', ticket, message, messages };
  }
}

function validateCreateTicketPayload(payload: CreateSupportTicketRequestDto): string[] {
  const errors: string[] = [];

  if (!payload.customerId || payload.customerId.trim().length < 3) {
    errors.push('customerId must contain at least 3 characters');
  }

  if (!payload.subject || payload.subject.trim().length < 3) {
    errors.push('subject must contain at least 3 characters');
  }

  return errors;
}

function validateAddMessagePayload(payload: AddTicketMessageRequestDto): string[] {
  const errors: string[] = [];

  if (!payload.senderType || !['customer', 'support_agent', 'system'].includes(payload.senderType)) {
    errors.push('senderType must be one of customer, support_agent, system');
  }

  if (!payload.message || payload.message.trim().length < 1) {
    errors.push('message is required');
  }

  return errors;
}

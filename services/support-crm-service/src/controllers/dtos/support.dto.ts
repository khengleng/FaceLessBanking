import type { SupportTicket } from '../../domain/support-ticket.js';
import type { TicketMessage } from '../../domain/ticket-message.js';

export type CreateSupportTicketRequestDto = {
  customerId: string;
  subject: string;
};

export type AddTicketMessageRequestDto = {
  senderType: 'customer' | 'support_agent' | 'system';
  message: string;
};

export type SupportTicketResponseDto = SupportTicket & {
  messages: TicketMessage[];
};

export function toSupportTicketResponseDto(input: {
  ticket: SupportTicket;
  messages: TicketMessage[];
}): SupportTicketResponseDto {
  return {
    ticketId: input.ticket.ticketId,
    customerId: input.ticket.customerId,
    subject: input.ticket.subject,
    status: input.ticket.status,
    createdAt: input.ticket.createdAt,
    updatedAt: input.ticket.updatedAt,
    messages: input.messages
  };
}

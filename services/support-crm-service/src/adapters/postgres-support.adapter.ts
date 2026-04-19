import type { SupportTicket } from '../domain/support-ticket.js';
import type { TicketMessage } from '../domain/ticket-message.js';

export class PostgresSupportAdapter {
  private readonly tickets = new Map<string, SupportTicket>();

  private readonly messagesByTicket = new Map<string, TicketMessage[]>();

  async insertTicket(ticket: SupportTicket): Promise<void> {
    this.tickets.set(ticket.ticketId, ticket);
    this.messagesByTicket.set(ticket.ticketId, []);
  }

  async findTicketById(ticketId: string): Promise<SupportTicket | null> {
    return this.tickets.get(ticketId) ?? null;
  }

  async appendTicketMessage(message: TicketMessage): Promise<void> {
    const existing = this.messagesByTicket.get(message.ticketId) ?? [];
    this.messagesByTicket.set(message.ticketId, [...existing, message]);
  }

  async findMessagesByTicketId(ticketId: string): Promise<TicketMessage[]> {
    return this.messagesByTicket.get(ticketId) ?? [];
  }
}

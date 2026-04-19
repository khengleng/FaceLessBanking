export type TicketMessage = {
  messageId: string;
  ticketId: string;
  senderType: 'customer' | 'support_agent' | 'system';
  message: string;
  createdAt: string;
};

export function buildTicketMessage(input: {
  messageId: string;
  ticketId: string;
  senderType: 'customer' | 'support_agent' | 'system';
  message: string;
  createdAt: string;
}): TicketMessage {
  return {
    messageId: input.messageId,
    ticketId: input.ticketId,
    senderType: input.senderType,
    message: input.message,
    createdAt: input.createdAt
  };
}

export type SupportCaseStatus = 'open' | 'in_progress' | 'resolved';

export type SupportTicket = {
  ticketId: string;
  customerId: string;
  subject: string;
  status: SupportCaseStatus;
  createdAt: string;
  updatedAt: string;
};

export function buildSupportTicket(input: {
  ticketId: string;
  customerId: string;
  subject: string;
  createdAt: string;
}): SupportTicket {
  return {
    ticketId: input.ticketId,
    customerId: input.customerId,
    subject: input.subject,
    status: 'open',
    createdAt: input.createdAt,
    updatedAt: input.createdAt
  };
}

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { SupportCrmApplication } from '../application/support-crm.application.js';
import type {
  AddTicketMessageRequestDto,
  CreateSupportTicketRequestDto
} from './dtos/support.dto.js';
import { toSupportTicketResponseDto } from './dtos/support.dto.js';

type CreateTicketRequest = FastifyRequest<{ Body: CreateSupportTicketRequestDto }>;
type GetTicketRequest = FastifyRequest<{ Params: { ticketId: string } }>;
type AddMessageRequest = FastifyRequest<{
  Params: { ticketId: string };
  Body: AddTicketMessageRequestDto;
}>;

export function buildSupportCrmController(supportCrmApplication: SupportCrmApplication) {
  async function createTicket(request: CreateTicketRequest, reply: FastifyReply): Promise<void> {
    const result = await supportCrmApplication.createTicket(request.body);

    if (result.kind === 'invalid_payload') {
      reply.code(400).send({
        error: 'validation_failed',
        details: result.errors
      });
      return;
    }

    reply.code(201).send(
      toSupportTicketResponseDto({
        ticket: result.ticket,
        messages: result.messages
      })
    );
  }

  async function getTicket(request: GetTicketRequest, reply: FastifyReply): Promise<void> {
    const result = await supportCrmApplication.getTicket(request.params.ticketId);

    if (result.kind === 'not_found') {
      reply.code(404).send({ error: 'ticket_not_found' });
      return;
    }

    reply.code(200).send(
      toSupportTicketResponseDto({
        ticket: result.ticket,
        messages: result.messages
      })
    );
  }

  async function addMessage(request: AddMessageRequest, reply: FastifyReply): Promise<void> {
    const result = await supportCrmApplication.addMessage(request.params.ticketId, request.body);

    if (result.kind === 'invalid_payload') {
      reply.code(400).send({
        error: 'validation_failed',
        details: result.errors
      });
      return;
    }

    if (result.kind === 'ticket_not_found') {
      reply.code(404).send({ error: 'ticket_not_found' });
      return;
    }

    reply.code(201).send(
      toSupportTicketResponseDto({
        ticket: result.ticket,
        messages: result.messages
      })
    );
  }

  return {
    createTicket,
    getTicket,
    addMessage
  };
}

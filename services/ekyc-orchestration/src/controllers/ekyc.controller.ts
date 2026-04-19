import type { FastifyReply, FastifyRequest } from 'fastify';

import type { EkycApplication } from '../application/ekyc.application.js';
import type {
  CreateSessionRequestDto,
  SubmitLivenessRequestDto,
  UploadDocumentsRequestDto
} from './dtos/ekyc.dto.js';
import { toEkycSessionResponseDto } from './dtos/ekyc.dto.js';

type CreateSessionRequest = FastifyRequest<{ Body: CreateSessionRequestDto }>;
type UploadDocumentsRequest = FastifyRequest<{
  Params: { sessionId: string };
  Body: UploadDocumentsRequestDto;
}>;
type SubmitLivenessRequest = FastifyRequest<{
  Params: { sessionId: string };
  Body: SubmitLivenessRequestDto;
}>;
type GetSessionRequest = FastifyRequest<{ Params: { sessionId: string } }>;

export function buildEkycController(ekycApplication: EkycApplication) {
  async function createSession(request: CreateSessionRequest, reply: FastifyReply): Promise<void> {
    const result = await ekycApplication.createSession(request.body);

    if (result.kind === 'invalid_payload') {
      reply.code(400).send({
        error: 'validation_failed',
        details: result.errors
      });
      return;
    }

    reply.code(201).send(toEkycSessionResponseDto(result.session));
  }

  async function uploadDocuments(
    request: UploadDocumentsRequest,
    reply: FastifyReply
  ): Promise<void> {
    const result = await ekycApplication.uploadDocuments(request.params.sessionId, request.body);

    if (result.kind === 'invalid_payload') {
      reply.code(400).send({
        error: 'validation_failed',
        details: result.errors
      });
      return;
    }

    if (result.kind === 'not_found') {
      reply.code(404).send({ error: 'ekyc_session_not_found' });
      return;
    }

    reply.code(200).send(toEkycSessionResponseDto(result.session));
  }

  async function submitLiveness(
    request: SubmitLivenessRequest,
    reply: FastifyReply
  ): Promise<void> {
    const result = await ekycApplication.submitLiveness(request.params.sessionId, request.body);

    if (result.kind === 'invalid_payload') {
      reply.code(400).send({
        error: 'validation_failed',
        details: result.errors
      });
      return;
    }

    if (result.kind === 'not_found') {
      reply.code(404).send({ error: 'ekyc_session_not_found' });
      return;
    }

    reply.code(200).send(toEkycSessionResponseDto(result.session));
  }

  async function getSession(request: GetSessionRequest, reply: FastifyReply): Promise<void> {
    const result = await ekycApplication.getSessionById(request.params.sessionId);

    if (result.kind === 'not_found') {
      reply.code(404).send({ error: 'ekyc_session_not_found' });
      return;
    }

    reply.code(200).send(toEkycSessionResponseDto(result.session));
  }

  return {
    createSession,
    uploadDocuments,
    submitLiveness,
    getSession
  };
}

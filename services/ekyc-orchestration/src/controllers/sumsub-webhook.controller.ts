import type { FastifyReply, FastifyRequest } from 'fastify';

import type { SumsubWebhookApplication } from '../application/sumsub-webhook.application.js';
import type { SumsubWebhookPayloadDto } from './dtos/sumsub-webhook.dto.js';

type SumsubWebhookRequest = FastifyRequest<{ Body: SumsubWebhookPayloadDto }>;

export function buildSumsubWebhookController(application: SumsubWebhookApplication) {
  async function handleWebhook(request: SumsubWebhookRequest, reply: FastifyReply): Promise<void> {
    const rawBody = JSON.stringify(request.body ?? {});

    const result = await application.processWebhook({
      headers: request.headers,
      rawBody,
      payload: request.body
    });

    if (result.kind === 'invalid_signature') {
      reply.code(401).send({ error: 'invalid_signature' });
      return;
    }

    if (result.kind === 'invalid_payload') {
      reply.code(400).send({
        error: 'validation_failed',
        details: result.errors
      });
      return;
    }

    if (result.kind === 'session_not_found') {
      reply.code(404).send({ error: 'ekyc_session_not_found' });
      return;
    }

    if (result.kind === 'duplicate') {
      reply.code(200).send({
        accepted: true,
        duplicate: true
      });
      return;
    }

    reply.code(200).send({
      accepted: true,
      sessionId: result.sessionId,
      status: result.newStatus
    });
  }

  return {
    handleWebhook
  };
}

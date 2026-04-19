import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AiApplication } from '../application/ai.application.js';
import type {
  AiResponseDto,
  ChatRequestDto,
  ClassifyRequestDto,
  SummarizeRequestDto
} from './dtos/ai.dto.js';

type ChatRequest = FastifyRequest<{ Body: ChatRequestDto }>;
type SummarizeRequest = FastifyRequest<{ Body: SummarizeRequestDto }>;
type ClassifyRequest = FastifyRequest<{ Body: ClassifyRequestDto }>;

export function buildAiController(aiApplication: AiApplication) {
  async function chat(request: ChatRequest, reply: FastifyReply): Promise<void> {
    const result = await aiApplication.chat(request.body);
    return handleAiResult(result, reply);
  }

  async function summarize(request: SummarizeRequest, reply: FastifyReply): Promise<void> {
    const result = await aiApplication.summarize(request.body);
    return handleAiResult(result, reply);
  }

  async function classify(request: ClassifyRequest, reply: FastifyReply): Promise<void> {
    const result = await aiApplication.classify(request.body);
    return handleAiResult(result, reply);
  }

  return {
    chat,
    summarize,
    classify
  };
}

function handleAiResult(
  result:
    | { kind: 'ok'; output: string; model: string }
    | { kind: 'invalid_payload'; errors: string[] }
    | { kind: 'blocked'; reason: string },
  reply: FastifyReply
): void {
  if (result.kind === 'invalid_payload') {
    reply.code(400).send({
      error: 'validation_failed',
      details: result.errors
    });
    return;
  }

  if (result.kind === 'blocked') {
    reply.code(403).send({
      error: 'guardrail_blocked',
      reason: result.reason
    });
    return;
  }

  const response: AiResponseDto = {
    output: result.output,
    model: result.model
  };

  reply.code(200).send(response);
}

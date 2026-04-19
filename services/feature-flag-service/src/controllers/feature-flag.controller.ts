import type { FastifyReply, FastifyRequest } from 'fastify';

import type { FeatureFlagApplication } from '../application/feature-flag.application.js';

type GetFlagByKeyRequest = FastifyRequest<{
  Params: {
    flagKey: string;
  };
}>;

type UpsertFlagRequest = FastifyRequest<{
  Body: {
    flagKey?: unknown;
    description?: unknown;
    enabled?: unknown;
    environments?: unknown;
    roles?: unknown;
  };
}>;

export function buildFeatureFlagController(application: FeatureFlagApplication) {
  async function listFlags(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const flags = await application.listFlags();

    reply.code(200).send({
      success: true,
      data: {
        items: flags
      }
    });
  }

  async function getFlagByKey(request: GetFlagByKeyRequest, reply: FastifyReply): Promise<void> {
    const result = await application.getFlagByKey(request.params.flagKey);

    if (result.kind === 'invalid') {
      reply.code(400).send({
        success: false,
        error: 'validation_failed',
        details: result.errors
      });
      return;
    }

    if (result.kind === 'not_found') {
      reply.code(404).send({
        success: false,
        error: 'feature_flag_not_found'
      });
      return;
    }

    reply.code(200).send({
      success: true,
      data: result.flag
    });
  }

  async function postFlag(request: UpsertFlagRequest, reply: FastifyReply): Promise<void> {
    const idempotencyHeader = request.headers['idempotency-key'];
    const idempotencyKey = Array.isArray(idempotencyHeader)
      ? idempotencyHeader[0]
      : idempotencyHeader;

    const result = await application.upsertFlag({
      idempotencyKey,
      flagKey: request.body?.flagKey,
      description: request.body?.description,
      enabled: request.body?.enabled,
      environments: request.body?.environments,
      roles: request.body?.roles
    });

    if (result.kind === 'invalid') {
      reply.code(400).send({
        success: false,
        error: 'validation_failed',
        details: result.errors
      });
      return;
    }

    if (result.kind === 'duplicate') {
      reply.code(409).send({
        success: false,
        error: 'duplicate_request'
      });
      return;
    }

    reply.code(200).send({
      success: true,
      data: result.flag
    });
  }

  return {
    listFlags,
    getFlagByKey,
    postFlag
  };
}

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { ConfigApplication } from '../application/config.application.js';

type UpdateConfigRequest = FastifyRequest<{
  Body: {
    key?: unknown;
    value?: unknown;
    reason?: unknown;
  };
}>;

type GetConfigByKeyRequest = FastifyRequest<{
  Params: {
    key: string;
  };
}>;

type GetFeatureFlagRequest = FastifyRequest<{
  Params: { flagKey: string };
}>;

type ToggleFeatureFlagRequest = FastifyRequest<{
  Params: { flagKey: string };
  Body: { enabled: unknown };
}>;

export function buildConfigController(application: ConfigApplication) {
  async function getConfig(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const config = await application.getConfig();

    reply.code(200).send({
      success: true,
      data: config
    });
  }

  async function postConfig(request: UpdateConfigRequest, reply: FastifyReply): Promise<void> {
    const idempotencyKeyHeader = request.headers['idempotency-key'];
    const idempotencyKey = Array.isArray(idempotencyKeyHeader)
      ? idempotencyKeyHeader[0]
      : idempotencyKeyHeader;

    const result = await application.updateConfig({
      idempotencyKey,
      key: request.body?.key,
      value: request.body?.value,
      updatedBy: request.headers['x-actor-id'],
      reason: request.body?.reason
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
      data: result.entry
    });
  }

  async function getConfigByKey(
    request: GetConfigByKeyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const result = await application.getConfigByKey(request.params.key);

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
        error: 'config_not_found'
      });
      return;
    }

    reply.code(200).send({
      success: true,
      data: result.entry
    });
  }

  async function getFeatureFlag(
    request: GetFeatureFlagRequest,
    reply: FastifyReply
  ): Promise<void> {
    const flag = await application.getFeatureFlag(request.params.flagKey);

    if (!flag) {
      reply.code(400).send({
        success: false,
        error: 'validation_failed',
        details: ['flagKey must contain at least 2 characters']
      });
      return;
    }

    reply.code(200).send({
      success: true,
      data: flag
    });
  }

  async function postFeatureFlag(
    request: ToggleFeatureFlagRequest,
    reply: FastifyReply
  ): Promise<void> {
    const idempotencyKeyHeader = request.headers['idempotency-key'];
    const idempotencyKey = Array.isArray(idempotencyKeyHeader)
      ? idempotencyKeyHeader[0]
      : idempotencyKeyHeader;

    const result = await application.toggleFeatureFlag({
      flagKey: request.params.flagKey,
      enabled: request.body?.enabled,
      idempotencyKey
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
    getConfig,
    getConfigByKey,
    postConfig,
    getFeatureFlag,
    postFeatureFlag
  };
}

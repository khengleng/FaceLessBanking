import crypto from 'node:crypto';

import type { FastifyRequest } from 'fastify';
import { type CorrelationId, toCorrelationId } from '@faceless-banking/shared-types';

declare module 'fastify' {
  interface FastifyRequest {
    correlationId: CorrelationId;
  }
}

export function resolveCorrelationId(request: FastifyRequest): CorrelationId {
  const raw = request.headers['x-correlation-id'];

  if (typeof raw === 'string' && raw.trim().length > 0) {
    return toCorrelationId(raw.trim());
  }

  return toCorrelationId(crypto.randomUUID());
}

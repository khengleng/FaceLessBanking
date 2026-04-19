import type { FastifyReply, FastifyRequest } from 'fastify';
import { buildSuccessResponse } from '@faceless-banking/shared-types';

import type { AMLApplication } from '../application/aml.application.js';

export function buildAMLController(application: AMLApplication) {
  async function getAlerts(_request: FastifyRequest, reply: FastifyReply) {
    const alerts = await application.listAlerts();
    return reply.send(buildSuccessResponse({ data: alerts }));
  }

  return { getAlerts };
}

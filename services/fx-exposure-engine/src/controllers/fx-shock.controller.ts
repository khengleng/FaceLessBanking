import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  buildErrorResponse,
  buildNotFoundError,
  buildSuccessResponse,
  buildValidationError
} from '@faceless-banking/shared-types';
import { z } from 'zod';

import type { FxShockApplication } from '../application/fx-shock.application.js';

const ScenarioQuerySchema = z.object({
  reportingCurrency: z.string().trim().length(3).optional()
});

const RunPayloadSchema = z.object({
  scenarioId: z.string().trim().optional(),
  shockPercent: z.number().min(-100).max(100).optional(),
  reportingCurrency: z.string().trim().length(3).optional()
});

export function buildFxShockController(application: FxShockApplication) {
  async function getScenarios(
    request: FastifyRequest<{ Querystring: { reportingCurrency?: string } }>,
    reply: FastifyReply
  ) {
    const parsed = ScenarioQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send(buildErrorResponse({
        error: buildValidationError({ message: 'Invalid reportingCurrency query parameter' })
      }));
    }

    const scenarios = application.getScenarios(parsed.data.reportingCurrency);
    return reply.send(buildSuccessResponse({ data: scenarios }));
  }

  async function postRunScenario(request: FastifyRequest, reply: FastifyReply) {
    const parsed = RunPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(buildErrorResponse({
        error: buildValidationError({ message: 'Invalid shock scenario request payload' })
      }));
    }

    if (!parsed.data.scenarioId && parsed.data.shockPercent === undefined) {
      return reply.code(400).send(buildErrorResponse({
        error: buildValidationError({ message: 'Either scenarioId or shockPercent is required' })
      }));
    }

    try {
      const run = await application.runScenario(parsed.data);
      return reply.send(buildSuccessResponse({ data: run }));
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'scenario_not_found') {
        return reply.code(404).send(buildErrorResponse({
          error: buildNotFoundError('Shock scenario not found')
        }));
      }

      if (error instanceof Error && error.message === 'invalid_scenario_request') {
        return reply.code(400).send(buildErrorResponse({
          error: buildValidationError({ message: 'Invalid scenario request' })
        }));
      }

      throw error;
    }
  }

  async function getScenarioResult(
    request: FastifyRequest<{ Params: { scenarioId: string }; Querystring: { reportingCurrency?: string } }>,
    reply: FastifyReply
  ) {
    const parsed = ScenarioQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send(buildErrorResponse({
        error: buildValidationError({ message: 'Invalid reportingCurrency query parameter' })
      }));
    }

    const run = await application.getScenarioResult(
      request.params.scenarioId,
      parsed.data.reportingCurrency
    );

    if (!run) {
      return reply.code(404).send(buildErrorResponse({
        error: buildNotFoundError('Shock scenario result not found')
      }));
    }

    return reply.send(buildSuccessResponse({ data: run }));
  }

  return {
    getScenarios,
    postRunScenario,
    getScenarioResult
  };
}

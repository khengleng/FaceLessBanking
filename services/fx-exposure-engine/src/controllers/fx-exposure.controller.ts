import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  buildErrorResponse,
  buildNotFoundError,
  buildSuccessResponse,
  buildValidationError
} from '@faceless-banking/shared-types';
import { z } from 'zod';

import type { FxExposureApplication } from '../application/fx-exposure.application.js';

const ReportingCurrencyQuerySchema = z.object({
  reportingCurrency: z.string().trim().length(3).optional()
});

export function buildFxExposureController(application: FxExposureApplication) {
  async function getExposures(
    request: FastifyRequest<{ Querystring: { reportingCurrency?: string } }>,
    reply: FastifyReply
  ) {
    const parsed = ReportingCurrencyQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send(buildErrorResponse({
        error: buildValidationError({ message: 'Invalid reportingCurrency query parameter' })
      }));
    }

    const exposures = await application.getExposures(parsed.data.reportingCurrency);
    return reply.send(buildSuccessResponse({ data: exposures }));
  }

  async function getExposureByCurrency(
    request: FastifyRequest<{ Params: { currency: string }; Querystring: { reportingCurrency?: string } }>,
    reply: FastifyReply
  ) {
    const parsed = ReportingCurrencyQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send(buildErrorResponse({
        error: buildValidationError({ message: 'Invalid reportingCurrency query parameter' })
      }));
    }

    const exposure = await application.getExposureByCurrency(request.params.currency, parsed.data.reportingCurrency);
    if (!exposure) {
      return reply.code(404).send(buildErrorResponse({
        error: buildNotFoundError(`Exposure for currency ${request.params.currency.toUpperCase()} not found`)
      }));
    }

    return reply.send(buildSuccessResponse({ data: exposure }));
  }

  async function getExposureSummary(
    request: FastifyRequest<{ Querystring: { reportingCurrency?: string } }>,
    reply: FastifyReply
  ) {
    const parsed = ReportingCurrencyQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send(buildErrorResponse({
        error: buildValidationError({ message: 'Invalid reportingCurrency query parameter' })
      }));
    }

    const summary = await application.getExposureSummary(parsed.data.reportingCurrency);
    return reply.send(buildSuccessResponse({ data: summary }));
  }

  return {
    getExposures,
    getExposureByCurrency,
    getExposureSummary
  };
}

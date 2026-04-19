import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  buildErrorResponse,
  buildNotFoundError,
  buildSuccessResponse,
  buildValidationError,
  type FieldErrorMap
} from '@faceless-banking/shared-types';
import { z } from 'zod';

import type { FXApplication } from '../application/fx.application.js';

const CurrencySchema = z.object({
  currencyCode: z.string().trim().length(3),
  currencyName: z.string().trim().min(1),
  decimalPlaces: z.number().int().min(0).max(8)
});

const FXRateSchema = z.object({
  baseCurrency: z.string().trim().length(3),
  quoteCurrency: z.string().trim().length(3),
  rateValue: z.string().regex(/^\d+(\.\d+)?$/),
  effectiveAt: z.string().datetime().optional()
});

const FXPairQuerySchema = z.object({
  base: z.string().trim().length(3),
  quote: z.string().trim().length(3)
});

export function buildFXController(app: FXApplication) {
  async function postCurrency(request: FastifyRequest, reply: FastifyReply) {
    const parsed = CurrencySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(validationErrorFromZod(parsed.error.flatten().fieldErrors));
    }

    try {
      const currency = await app.createCurrency({
        ...parsed.data,
        currencyCode: parsed.data.currencyCode.toUpperCase()
      });

      return reply.send(buildSuccessResponse({ data: currency }));
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'currency_exists') {
        return reply.code(409).send(buildErrorResponse({
          error: {
            code: 'conflict',
            message: `Currency ${parsed.data.currencyCode.toUpperCase()} already exists`,
            retriable: false
          }
        }));
      }

      throw error;
    }
  }

  async function getCurrency(request: FastifyRequest<{ Params: { currencyCode: string } }>, reply: FastifyReply) {
    const currency = await app.getCurrencyByCode(request.params.currencyCode);
    if (!currency) {
      return reply.code(404).send(buildErrorResponse({
        error: buildNotFoundError('Currency not found')
      }));
    }

    return reply.send(buildSuccessResponse({ data: currency }));
  }

  async function postFxRate(request: FastifyRequest, reply: FastifyReply) {
    const parsed = FXRateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(validationErrorFromZod(parsed.error.flatten().fieldErrors));
    }

    try {
      const correlationId = getCorrelationId(request);
      const rate = await app.submitFxRate({
        baseCurrency: parsed.data.baseCurrency,
        quoteCurrency: parsed.data.quoteCurrency,
        rateValue: parsed.data.rateValue,
        effectiveAt: parsed.data.effectiveAt ?? new Date().toISOString(),
        correlationId
      });

      return reply.send(buildSuccessResponse({ data: rate }));
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'currency_not_found') {
        return reply.code(400).send(buildErrorResponse({
          error: buildValidationError({ message: 'Invalid currency pair. Both currencies must exist.' })
        }));
      }

      if (error instanceof Error && error.message === 'invalid_currency_pair') {
        return reply.code(400).send(buildErrorResponse({
          error: buildValidationError({ message: 'Base and quote currencies must be different.' })
        }));
      }

      throw error;
    }
  }

  async function getLatestFxRate(
    request: FastifyRequest<{ Querystring: { base?: string; quote?: string } }>,
    reply: FastifyReply
  ) {
    const parsed = FXPairQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send(validationErrorFromZod(parsed.error.flatten().fieldErrors));
    }

    const rate = await app.getLatestFxRate(parsed.data.base, parsed.data.quote);
    if (!rate) {
      return reply.code(404).send(buildErrorResponse({
        error: buildNotFoundError(`No rate found for ${parsed.data.base.toUpperCase()}/${parsed.data.quote.toUpperCase()}`)
      }));
    }

    return reply.send(buildSuccessResponse({ data: rate }));
  }

  async function getFxRateHistory(
    request: FastifyRequest<{ Querystring: { base?: string; quote?: string } }>,
    reply: FastifyReply
  ) {
    const parsed = FXPairQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send(validationErrorFromZod(parsed.error.flatten().fieldErrors));
    }

    const history = await app.getFxRateHistory(parsed.data.base, parsed.data.quote);
    return reply.send(buildSuccessResponse({ data: history }));
  }

  return {
    postCurrency,
    getCurrency,
    postFxRate,
    getLatestFxRate,
    getFxRateHistory
  };
}

function validationErrorFromZod(fieldErrors: Record<string, string[] | undefined>) {
  const normalized: FieldErrorMap = {};

  for (const [field, errors] of Object.entries(fieldErrors)) {
    if (errors && errors.length > 0) {
      normalized[field] = errors;
    }
  }

  return buildErrorResponse({
    error: buildValidationError({
      message: 'Validation failed',
      fieldErrors: normalized
    })
  });
}

function getCorrelationId(request: FastifyRequest): string | undefined {
  const raw = request.headers['x-correlation-id'];
  if (typeof raw === 'string' && raw.length > 0) {
    return raw;
  }

  return undefined;
}

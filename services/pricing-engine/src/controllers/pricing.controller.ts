import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { buildErrorResponse, buildSuccessResponse, buildValidationError } from '@faceless-banking/shared-types';
import type { PricingApplication } from '../application/pricing.application.js';

const TransferPricingSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()),
  transferType: z.enum(['INTERNAL', 'EXTERNAL', 'INSTANT'])
});

const FXPricingSchema = z.object({
  baseCurrency: z.string().length(3).transform((value) => value.toUpperCase()),
  quoteCurrency: z.string().length(3).transform((value) => value.toUpperCase()),
  amount: z.number().positive()
});

export function buildPricingController(app: PricingApplication) {
  async function calculateTransferPricing(request: FastifyRequest, reply: FastifyReply) {
    const parsed = TransferPricingSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(buildErrorResponse({
        error: buildValidationError({ message: 'Invalid transfer pricing payload' })
      }));
    }

    try {
      const result = await app.calculateTransferPricing(parsed.data);
      return reply.send(buildSuccessResponse({ data: result }));
    } catch (error: unknown) {
      void error;
      return reply.code(500).send(buildErrorResponse({
        error: {
          code: 'internal_error',
          message: 'Transfer pricing calculation failed',
          retriable: true
        }
      }));
    }
  }

  async function calculateFXPricing(request: FastifyRequest, reply: FastifyReply) {
    const parsed = FXPricingSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(buildErrorResponse({
        error: buildValidationError({ message: 'Invalid FX pricing payload' })
      }));
    }

    try {
      const result = await app.calculateFXPricing(parsed.data);
      return reply.send(buildSuccessResponse({ data: result }));
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'fx_rate_not_found') {
        return reply.code(404).send(buildErrorResponse({
          error: {
            code: 'not_found',
            message: 'FX rate not found for currency pair',
            retriable: false
          }
        }));
      }

      if (error instanceof Error && error.message === 'invalid_fx_rate') {
        return reply.code(400).send(buildErrorResponse({
          error: buildValidationError({ message: 'Invalid FX base rate returned by adapter' })
        }));
      }

      return reply.code(500).send(buildErrorResponse({
        error: {
          code: 'internal_error',
          message: 'FX pricing calculation failed',
          retriable: true
        }
      }));
    }
  }

  return { calculateTransferPricing, calculateFXPricing };
}

import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { buildErrorResponse, buildSuccessResponse, buildValidationError } from '@faceless-banking/shared-types';

import type { ProfitabilityApplication } from '../application/profitability.application.js';

const ListRecordsQuerySchema = z.object({
  category: z.enum(['INTEREST_INCOME', 'FEE_INCOME', 'FX_INCOME', 'FUNDING_COST']).optional(),
  relatedEntityId: z.string().min(1).optional()
});

const CustomerPathSchema = z.object({
  customerId: z.string().min(1)
});

const ProductPathSchema = z.object({
  productType: z.string().min(1)
});

const CurrencyQuerySchema = z.object({
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional()
});

export function buildProfitabilityController(application: ProfitabilityApplication) {
  async function listRevenueCostRecords(request: FastifyRequest, reply: FastifyReply) {
    const parsed = ListRecordsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send(
        buildErrorResponse({
          error: buildValidationError({ message: 'Invalid profitability query filters' })
        })
      );
    }

    const records = await application.listRecords(parsed.data);
    return reply.send(buildSuccessResponse({ data: records }));
  }

  async function getCustomerProfitability(
    request: FastifyRequest<{ Params: { customerId: string } }>,
    reply: FastifyReply
  ) {
    const parsed = CustomerPathSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send(
        buildErrorResponse({
          error: buildValidationError({ message: 'Invalid customer profitability request' })
        })
      );
    }

    const view = await application.getCustomerProfitability(parsed.data.customerId);
    return reply.send(buildSuccessResponse({ data: view }));
  }

  async function getProductProfitability(
    request: FastifyRequest<{ Params: { productType: string } }>,
    reply: FastifyReply
  ) {
    const parsed = ProductPathSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send(
        buildErrorResponse({
          error: buildValidationError({ message: 'Invalid product profitability request' })
        })
      );
    }

    const view = await application.getProductProfitability(parsed.data.productType);
    return reply.send(buildSuccessResponse({ data: view }));
  }

  async function getBankPnL(
    request: FastifyRequest<{ Querystring: { currency?: string } }>,
    reply: FastifyReply
  ) {
    const parsed = CurrencyQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send(
        buildErrorResponse({
          error: buildValidationError({ message: 'Invalid P&L query filters' })
        })
      );
    }

    const pnl = await application.getBankPnL(parsed.data.currency ?? 'USD');
    return reply.send(buildSuccessResponse({ data: pnl }));
  }

  async function getMarginMetrics(
    request: FastifyRequest<{ Querystring: { currency?: string } }>,
    reply: FastifyReply
  ) {
    const parsed = CurrencyQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send(
        buildErrorResponse({
          error: buildValidationError({ message: 'Invalid margin query filters' })
        })
      );
    }

    const margins = await application.getMarginMetrics(parsed.data.currency ?? 'USD');
    return reply.send(buildSuccessResponse({ data: margins }));
  }

  return { listRevenueCostRecords, getCustomerProfitability, getProductProfitability, getBankPnL, getMarginMetrics };
}

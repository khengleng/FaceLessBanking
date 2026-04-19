import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { buildSuccessResponse } from '@faceless-banking/shared-types';
import type { DashboardApplication } from '../application/dashboard.application.js';

const QuerySchema = z.object({
  status: z.string().optional(),
  customerId: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).optional(),
  offset: z.coerce.number().min(0).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

export function buildDashboardController(app: DashboardApplication) {
  async function getSummary(request: FastifyRequest, reply: FastifyReply) {
    const summary = await app.getSummary();
    return reply.send(buildSuccessResponse({ data: summary }));
  }

  async function getPayments(request: FastifyRequest, reply: FastifyReply) {
    const filters = QuerySchema.parse(request.query);
    const data = await app.getPayments(filters);
    return reply.send(buildSuccessResponse({ data }));
  }

  async function getLoans(request: FastifyRequest, reply: FastifyReply) {
    const filters = QuerySchema.parse(request.query);
    const data = await app.getLoans(filters);
    return reply.send(buildSuccessResponse({ data }));
  }

  async function getOnboarding(request: FastifyRequest, reply: FastifyReply) {
    const filters = QuerySchema.parse(request.query);
    const data = await app.getOnboarding(filters);
    return reply.send(buildSuccessResponse({ data }));
  }

  async function getDisputes(request: FastifyRequest, reply: FastifyReply) {
    const filters = QuerySchema.parse(request.query);
    const data = await app.getDisputes(filters);
    return reply.send(buildSuccessResponse({ data }));
  }

  return { getSummary, getPayments, getLoans, getOnboarding, getDisputes };
}

import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  buildErrorResponse,
  buildNotFoundError,
  buildSuccessResponse,
  buildValidationError,
  toCorrelationId,
  type CorrelationId
} from '@faceless-banking/shared-types';

import type { WorkflowCaseManagementApplication } from '../application/workflow-case-management.application.js';
import type {
  CreateCaseRequestDto,
  ListOnboardingCasesQueryDto,
  RecordCaseActionRequestDto
} from './dtos/case.dto.js';
import { toCaseResponseDto } from './dtos/case.dto.js';

type CreateCaseRequest = FastifyRequest<{ Body: CreateCaseRequestDto }>;
type GetCaseRequest = FastifyRequest<{ Params: { caseId: string } }>;
type GetCaseByEntityRequest = FastifyRequest<{
  Querystring: {
    entityType?: 'EKYC_SESSION' | 'CUSTOMER_ONBOARDING';
    entityId?: string;
  };
}>;
type ListOnboardingCasesRequest = FastifyRequest<{ Querystring: ListOnboardingCasesQueryDto }>;
type RecordActionRequest = FastifyRequest<{
  Params: { caseId: string };
  Body: RecordCaseActionRequestDto;
}>;

export function buildWorkflowCaseManagementController(
  workflowCaseManagementApplication: WorkflowCaseManagementApplication
) {
  function log(level: 'info' | 'warn', message: string, payload: Record<string, unknown>): void {
    const out = { level, service: 'workflow-case-management', message, ...payload };
    if (level === 'warn') {
      console.warn(JSON.stringify(out));
      return;
    }
    console.info(JSON.stringify(out));
  }

  function getCorrelationId(request: FastifyRequest): CorrelationId | undefined {
    const header = request.headers['x-correlation-id'];
    return typeof header === 'string' ? toCorrelationId(header) : undefined;
  }

  function authorizeInternalOps(request: FastifyRequest): {
    authorized: boolean;
    actorId?: string;
    reason?: string;
  } {
    const roleHeader = request.headers['x-internal-ops-role'];
    const actorIdHeader = request.headers['x-internal-ops-actor-id'];
    const role = typeof roleHeader === 'string' ? roleHeader : '';
    const actorId = typeof actorIdHeader === 'string' ? actorIdHeader : '';
    const allowedRoles = ['ops', 'compliance'];

    if (!actorId || actorId.trim().length < 3) {
      return { authorized: false, reason: 'x-internal-ops-actor-id is required' };
    }

    if (!allowedRoles.includes(role)) {
      return { authorized: false, reason: 'x-internal-ops-role must be ops or compliance' };
    }

    return { authorized: true, actorId };
  }

  async function createCase(request: CreateCaseRequest, reply: FastifyReply): Promise<void> {
    const result = await workflowCaseManagementApplication.createCase(request.body);
    const correlationId = getCorrelationId(request);

    if (result.kind === 'invalid_payload') {
      reply.code(400).send(buildErrorResponse({
        correlationId,
        error: buildValidationError({
          details: result.errors
        })
      }));
      return;
    }

    reply.code(201).send(buildSuccessResponse({
      correlationId,
      data: toCaseResponseDto({ record: result.record, actions: result.actions })
    }));
  }

  async function listOnboardingCases(
    request: ListOnboardingCasesRequest,
    reply: FastifyReply
  ): Promise<void> {
    const auth = authorizeInternalOps(request);
    const correlationId = getCorrelationId(request);
    if (!auth.authorized) {
      log('warn', 'Unauthorized onboarding queue list request', {
        correlationId,
        reason: auth.reason
      });
      reply.code(403).send(buildErrorResponse({
        correlationId,
        error: {
          code: 'forbidden',
          message: auth.reason ?? 'Forbidden',
          retriable: false
        }
      }));
      return;
    }

    const parsedQuery: ListOnboardingCasesQueryDto = {
      status: request.query.status,
      entityId: request.query.entityId,
      limit: request.query.limit ? Number(request.query.limit) : undefined,
      offset: request.query.offset ? Number(request.query.offset) : undefined
    };

    const result = await workflowCaseManagementApplication.listOnboardingCases(parsedQuery);
    if (result.kind === 'invalid_query') {
      reply.code(400).send(buildErrorResponse({
        correlationId,
        error: buildValidationError({ details: result.errors })
      }));
      return;
    }

    reply.code(200).send(buildSuccessResponse({
      correlationId,
      data: {
        items: result.records.map((record) => toCaseResponseDto({ record, actions: [] })),
        limit: parsedQuery.limit ?? 50,
        offset: parsedQuery.offset ?? 0
      }
    }));
    log('info', 'Listed onboarding review cases', {
      correlationId,
      count: result.records.length,
      status: parsedQuery.status,
      entityId: parsedQuery.entityId
    });
  }

  async function getCase(request: GetCaseRequest, reply: FastifyReply): Promise<void> {
    const auth = authorizeInternalOps(request);
    const correlationId = getCorrelationId(request);
    if (!auth.authorized) {
      log('warn', 'Unauthorized case detail request', {
        correlationId,
        reason: auth.reason
      });
      reply.code(403).send(buildErrorResponse({
        correlationId,
        error: {
          code: 'forbidden',
          message: auth.reason ?? 'Forbidden',
          retriable: false
        }
      }));
      return;
    }

    const result = await workflowCaseManagementApplication.getCase(request.params.caseId);

    if (result.kind === 'not_found') {
      reply.code(404).send(buildErrorResponse({
        correlationId,
        error: buildNotFoundError('Case not found')
      }));
      return;
    }

    reply.code(200).send(buildSuccessResponse({
      correlationId,
      data: toCaseResponseDto({ record: result.record, actions: result.actions })
    }));
  }

  async function getCaseByEntity(
    request: GetCaseByEntityRequest,
    reply: FastifyReply
  ): Promise<void> {
    const correlationId = getCorrelationId(request);
    const result = await workflowCaseManagementApplication.getCaseByEntity(
      request.query.entityType,
      request.query.entityId
    );

    if (result.kind === 'invalid_query') {
      reply.code(400).send(buildErrorResponse({
        correlationId,
        error: buildValidationError({ details: result.errors })
      }));
      return;
    }

    if (result.kind === 'not_found') {
      reply.code(404).send(buildErrorResponse({
        correlationId,
        error: buildNotFoundError('Case not found')
      }));
      return;
    }

    reply.code(200).send(buildSuccessResponse({
      correlationId,
      data: toCaseResponseDto({ record: result.record, actions: result.actions })
    }));
  }

  async function recordCaseAction(request: RecordActionRequest, reply: FastifyReply): Promise<void> {
    const correlationId = getCorrelationId(request);
    const auth = authorizeInternalOps(request);
    if (!auth.authorized) {
      log('warn', 'Unauthorized manual case action request', {
        correlationId,
        caseId: request.params.caseId,
        reason: auth.reason
      });
      reply.code(403).send(buildErrorResponse({
        correlationId,
        error: {
          code: 'forbidden',
          message: auth.reason ?? 'Forbidden',
          retriable: false
        }
      }));
      return;
    }

    const result = await workflowCaseManagementApplication.recordCaseAction(
      request.params.caseId,
      {
        ...request.body,
        actorId: auth.actorId
      }
    );

    if (result.kind === 'invalid_payload') {
      reply.code(400).send(buildErrorResponse({
        correlationId,
        error: buildValidationError({ details: result.errors })
      }));
      return;
    }

    if (result.kind === 'case_not_found') {
      reply.code(404).send(buildErrorResponse({
        correlationId,
        error: buildNotFoundError('Case not found')
      }));
      return;
    }

    if (result.kind === 'not_onboarding_case') {
      reply.code(409).send(buildErrorResponse({
        correlationId,
        error: {
          code: 'conflict',
          message: 'Only onboarding-review cases are allowed',
          retriable: false
        }
      }));
      return;
    }

    if (result.kind === 'invalid_transition') {
      reply.code(409).send(buildErrorResponse({
        correlationId,
        error: {
          code: 'conflict',
          message: 'Invalid case transition',
          details: result.errors,
          retriable: false
        }
      }));
      return;
    }

    if (result.kind === 'noop') {
      log('info', 'Skipped duplicate manual case status update', {
        correlationId,
        caseId: request.params.caseId,
        actionType: request.body.actionType
      });
      reply.code(200).send(buildSuccessResponse({
        correlationId,
        data: toCaseResponseDto({ record: result.record, actions: result.actions })
      }));
      return;
    }

    reply.code(201).send(buildSuccessResponse({
      correlationId,
      data: toCaseResponseDto({ record: result.record, actions: result.actions })
    }));
    log('info', 'Applied manual case action', {
      correlationId,
      caseId: request.params.caseId,
      actionType: request.body.actionType,
      newStatus: result.record.status
    });
  }

  return {
    createCase,
    listOnboardingCases,
    getCaseByEntity,
    getCase,
    recordCaseAction
  };
}

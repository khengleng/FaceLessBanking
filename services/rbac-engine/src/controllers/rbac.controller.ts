import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  buildErrorResponse,
  buildSuccessResponse,
  buildValidationError,
  type FieldErrorMap
} from '@faceless-banking/shared-types';
import { z } from 'zod';

import type { RbacApplication } from '../application/rbac.application.js';
import { RBAC_PERMISSIONS } from '../domain/rbac.js';

const CreateRoleSchema = z.object({
  name: z.string().trim().min(1),
  permissions: z.array(z.string().trim().min(1)).min(1)
});

const AssignRoleSchema = z.object({
  userId: z.string().trim().min(1),
  roleId: z.string().trim().min(1)
});

export function buildRbacController(application: RbacApplication) {
  async function postRoles(request: FastifyRequest, reply: FastifyReply) {
    const userId = getUserId(request);
    if (!userId) {
      return unauthorized(reply);
    }

    const permitted = await application.hasPermission(userId, RBAC_PERMISSIONS.CREATE_ROLE);
    if (!permitted) {
      return forbidden(reply);
    }

    const parsed = CreateRoleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(validationErrorFromZod(parsed.error.flatten().fieldErrors));
    }

    const idempotencyKey = getRequiredIdempotencyKey(request);
    if (!idempotencyKey) {
      return reply.code(400).send(
        buildErrorResponse({
          error: buildValidationError({
            message: 'Missing required x-idempotency-key header',
            fieldErrors: { 'x-idempotency-key': ['Header is required for write operations'] }
          })
        })
      );
    }

    const role = await application.createRole({
      name: parsed.data.name,
      permissions: parsed.data.permissions,
      idempotencyKey
    });

    return reply.send(buildSuccessResponse({ data: role }));
  }

  async function postAssign(request: FastifyRequest, reply: FastifyReply) {
    const userId = getUserId(request);
    if (!userId) {
      return unauthorized(reply);
    }

    const permitted = await application.hasPermission(userId, RBAC_PERMISSIONS.ASSIGN_ROLE);
    if (!permitted) {
      return forbidden(reply);
    }

    const parsed = AssignRoleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(validationErrorFromZod(parsed.error.flatten().fieldErrors));
    }

    const idempotencyKey = getRequiredIdempotencyKey(request);
    if (!idempotencyKey) {
      return reply.code(400).send(
        buildErrorResponse({
          error: buildValidationError({
            message: 'Missing required x-idempotency-key header',
            fieldErrors: { 'x-idempotency-key': ['Header is required for write operations'] }
          })
        })
      );
    }

    try {
      const userRole = await application.assignRole({
        userId: parsed.data.userId,
        roleId: parsed.data.roleId,
        idempotencyKey
      });

      return reply.send(buildSuccessResponse({ data: userRole }));
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'role_not_found') {
        return reply.code(404).send(
          buildErrorResponse({
            error: {
              code: 'not_found',
              message: 'Role not found',
              retriable: false
            }
          })
        );
      }

      return reply.code(500).send(
        buildErrorResponse({
          error: {
            code: 'internal_error',
            message: 'Unexpected role assignment error',
            retriable: true
          }
        })
      );
    }
  }

  return { postRoles, postAssign };
}

function getUserId(request: FastifyRequest): string | null {
  const raw = request.headers['x-user-id'];
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }

  return null;
}

function getRequiredIdempotencyKey(request: FastifyRequest): string | null {
  const raw = request.headers['x-idempotency-key'];
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }

  return null;
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

function unauthorized(reply: FastifyReply) {
  return reply.code(401).send(
    buildErrorResponse({
      error: {
        code: 'unauthorized',
        message: 'Missing or invalid user identity',
        retriable: false
      }
    })
  );
}

function forbidden(reply: FastifyReply) {
  return reply.code(403).send(
    buildErrorResponse({
      error: {
        code: 'forbidden',
        message: 'User lacks required permission',
        retriable: false
      }
    })
  );
}

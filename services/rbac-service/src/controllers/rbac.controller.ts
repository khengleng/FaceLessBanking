import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  buildErrorResponse,
  buildNotFoundError,
  buildSuccessResponse,
  buildValidationError,
  type CorrelationId,
  type FieldErrorMap
} from '@faceless-banking/shared-types';
import { z } from 'zod';

import { RBAC_MANAGEMENT_PERMISSIONS } from '../domain/rbac.js';
import type { RbacApplication } from '../application/rbac.application.js';

const CreateRoleSchema = z.object({
  roleName: z.string().trim().min(2),
  description: z.string().trim().min(1).default(''),
  permissionIds: z.array(z.string().trim().min(1)).default([])
});

const CreatePermissionSchema = z.object({
  permissionName: z.string().trim().min(3),
  resource: z.string().trim().min(1),
  action: z.string().trim().min(1)
});

const AssignRoleSchema = z.object({
  userId: z.string().trim().min(1),
  roleId: z.string().trim().min(1)
});

const ParamsRoleIdSchema = z.object({
  roleId: z.string().trim().min(1)
});

const ParamsUserIdSchema = z.object({
  userId: z.string().trim().min(1)
});

export function buildRbacController(application: RbacApplication) {
  async function postRoles(request: FastifyRequest, reply: FastifyReply) {
    if (!(await authorize(request, RBAC_MANAGEMENT_PERMISSIONS.ROLE_CREATE, application, reply))) {
      return;
    }

    const parsed = CreateRoleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(validationError(parsed.error.flatten().fieldErrors, request.correlationId));
    }

    const idempotencyKey = readIdempotencyKey(request);
    if (!idempotencyKey) {
      return reply.code(400).send(missingIdempotency(request.correlationId));
    }

    try {
      const role = await application.createRole({
        ...parsed.data,
        idempotencyKey
      });

      return reply.send(
        buildSuccessResponse({
          data: role,
          correlationId: request.correlationId
        })
      );
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'role_conflict') {
        return reply.code(409).send(
          buildErrorResponse({
            correlationId: request.correlationId,
            error: {
              code: 'conflict',
              message: 'Role name already exists',
              retriable: false
            }
          })
        );
      }

      if (error instanceof Error && error.message === 'permission_not_found') {
        return reply.code(404).send(
          buildErrorResponse({
            correlationId: request.correlationId,
            error: buildNotFoundError('One or more permissions were not found')
          })
        );
      }

      return reply.code(500).send(internalError(request.correlationId));
    }
  }

  async function getRoleById(request: FastifyRequest, reply: FastifyReply) {
    const parsed = ParamsRoleIdSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send(validationError(parsed.error.flatten().fieldErrors, request.correlationId));
    }

    const role = await application.getRoleById(parsed.data.roleId);
    if (!role) {
      return reply.code(404).send(
        buildErrorResponse({
          correlationId: request.correlationId,
          error: buildNotFoundError('Role not found')
        })
      );
    }

    return reply.send(
      buildSuccessResponse({
        data: role,
        correlationId: request.correlationId
      })
    );
  }

  async function postPermissions(request: FastifyRequest, reply: FastifyReply) {
    if (!(await authorize(request, RBAC_MANAGEMENT_PERMISSIONS.PERMISSION_CREATE, application, reply))) {
      return;
    }

    const parsed = CreatePermissionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(validationError(parsed.error.flatten().fieldErrors, request.correlationId));
    }

    const idempotencyKey = readIdempotencyKey(request);
    if (!idempotencyKey) {
      return reply.code(400).send(missingIdempotency(request.correlationId));
    }

    try {
      const permission = await application.createPermission({
        ...parsed.data,
        idempotencyKey
      });

      return reply.send(
        buildSuccessResponse({
          data: permission,
          correlationId: request.correlationId
        })
      );
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'permission_conflict') {
        return reply.code(409).send(
          buildErrorResponse({
            correlationId: request.correlationId,
            error: {
              code: 'conflict',
              message: 'Permission name already exists',
              retriable: false
            }
          })
        );
      }

      return reply.code(500).send(internalError(request.correlationId));
    }
  }

  async function postAssign(request: FastifyRequest, reply: FastifyReply) {
    if (!(await authorize(request, RBAC_MANAGEMENT_PERMISSIONS.ROLE_ASSIGN, application, reply))) {
      return;
    }

    const parsed = AssignRoleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(validationError(parsed.error.flatten().fieldErrors, request.correlationId));
    }

    const idempotencyKey = readIdempotencyKey(request);
    if (!idempotencyKey) {
      return reply.code(400).send(missingIdempotency(request.correlationId));
    }

    try {
      const result = await application.assignRoleToUser({
        ...parsed.data,
        idempotencyKey
      });

      return reply.send(
        buildSuccessResponse({
          data: {
            ...result.assignment,
            created: result.created
          },
          correlationId: request.correlationId
        })
      );
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'role_not_found') {
        return reply.code(404).send(
          buildErrorResponse({
            correlationId: request.correlationId,
            error: buildNotFoundError('Role not found')
          })
        );
      }

      return reply.code(500).send(internalError(request.correlationId));
    }
  }

  async function getUserRoles(request: FastifyRequest, reply: FastifyReply) {
    const parsed = ParamsUserIdSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send(validationError(parsed.error.flatten().fieldErrors, request.correlationId));
    }

    const roles = await application.listRolesByUser(parsed.data.userId);
    return reply.send(
      buildSuccessResponse({
        data: {
          userId: parsed.data.userId,
          roles
        },
        correlationId: request.correlationId
      })
    );
  }

  return {
    postRoles,
    getRoleById,
    postPermissions,
    postAssign,
    getUserRoles
  };
}

async function authorize(
  request: FastifyRequest,
  permissionName: string,
  application: RbacApplication,
  reply: FastifyReply
): Promise<boolean> {
  const userId = readUserId(request);
  if (!userId) {
    reply.code(401).send(
      buildErrorResponse({
        correlationId: request.correlationId,
        error: {
          code: 'unauthorized',
          message: 'Missing or invalid x-user-id',
          retriable: false
        }
      })
    );

    return false;
  }

  const allowed = await application.hasPermission({ userId, permissionName });
  if (!allowed) {
    reply.code(403).send(
      buildErrorResponse({
        correlationId: request.correlationId,
        error: {
          code: 'forbidden',
          message: 'User lacks required permission',
          retriable: false
        }
      })
    );

    return false;
  }

  return true;
}

function readUserId(request: FastifyRequest): string | null {
  const value = request.headers['x-user-id'];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  return null;
}

function readIdempotencyKey(request: FastifyRequest): string | null {
  const value = request.headers['x-idempotency-key'];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  return null;
}

function validationError(fieldErrors: Record<string, string[] | undefined>, correlationId: CorrelationId) {
  const normalized: FieldErrorMap = {};

  for (const [field, errors] of Object.entries(fieldErrors)) {
    if (errors && errors.length > 0) {
      normalized[field] = errors;
    }
  }

  return buildErrorResponse({
    correlationId,
    error: buildValidationError({
      message: 'Validation failed',
      fieldErrors: normalized
    })
  });
}

function missingIdempotency(correlationId: CorrelationId) {
  return buildErrorResponse({
    correlationId,
    error: buildValidationError({
      message: 'Missing required x-idempotency-key header',
      fieldErrors: {
        'x-idempotency-key': ['Header is required for write APIs']
      }
    })
  });
}

function internalError(correlationId: CorrelationId) {
  return buildErrorResponse({
    correlationId,
    error: {
      code: 'internal_error',
      message: 'Unexpected internal error',
      retriable: true
    }
  });
}

import assert from 'node:assert/strict';
import test from 'node:test';

import { InMemoryRbacPostgresAdapter } from '../adapters/postgres.adapter.js';
import { RbacApplication } from '../application/rbac.application.js';
import { RbacMetrics } from '../application/rbac.metrics.js';
import { createApp } from '../app.js';

test('health endpoint', async () => {
  const app = createApp();

  const response = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(response.statusCode, 200);

  const body = response.json();
  assert.equal(body.success, true);
  assert.equal(body.data.status, 'OK');

  await app.close();
});

test('role created', async () => {
  const app = createApp();

  const create = await app.inject({
    method: 'POST',
    url: '/auth/roles',
    headers: {
      'x-user-id': 'rbac-admin',
      'x-idempotency-key': 'idem-role-create-1'
    },
    payload: {
      roleName: 'OPS_ANALYST',
      description: 'Can view operations data',
      permissionIds: []
    }
  });

  assert.equal(create.statusCode, 200);
  const body = create.json();
  assert.equal(body.success, true);
  assert.equal(body.data.roleName, 'OPS_ANALYST');

  await app.close();
});

test('permission created', async () => {
  const app = createApp();

  const create = await app.inject({
    method: 'POST',
    url: '/auth/permissions',
    headers: {
      'x-user-id': 'rbac-admin',
      'x-idempotency-key': 'idem-perm-create-1'
    },
    payload: {
      permissionName: 'ops.dashboard.read',
      resource: 'ops.dashboard',
      action: 'read'
    }
  });

  assert.equal(create.statusCode, 200);
  const body = create.json();
  assert.equal(body.success, true);
  assert.equal(body.data.permissionName, 'ops.dashboard.read');

  await app.close();
});

test('role assigned and duplicate assignment skipped safely', async () => {
  const app = createApp();

  const role = await app.inject({
    method: 'POST',
    url: '/auth/roles',
    headers: {
      'x-user-id': 'rbac-admin',
      'x-idempotency-key': 'idem-role-create-2'
    },
    payload: {
      roleName: 'BACKOFFICE_AGENT',
      description: 'Backoffice role',
      permissionIds: []
    }
  });

  const roleId = role.json().data.roleId;

  const firstAssign = await app.inject({
    method: 'POST',
    url: '/auth/assign',
    headers: {
      'x-user-id': 'rbac-admin',
      'x-idempotency-key': 'idem-role-assign-1'
    },
    payload: {
      userId: 'user-ops-1',
      roleId
    }
  });

  assert.equal(firstAssign.statusCode, 200);
  assert.equal(firstAssign.json().data.created, true);

  const duplicateAssign = await app.inject({
    method: 'POST',
    url: '/auth/assign',
    headers: {
      'x-user-id': 'rbac-admin',
      'x-idempotency-key': 'idem-role-assign-2'
    },
    payload: {
      userId: 'user-ops-1',
      roleId
    }
  });

  assert.equal(duplicateAssign.statusCode, 200);
  assert.equal(duplicateAssign.json().data.created, false);

  await app.close();
});

test('unauthorized and missing permission lookup patterns are blocked safely in helper logic', async () => {
  const adapter = new InMemoryRbacPostgresAdapter();
  const appLogic = new RbacApplication(adapter, console, new RbacMetrics());

  const missingPermissionAllowed = await appLogic.hasPermission({
    userId: 'rbac-admin',
    permissionName: 'nonexistent.permission'
  });
  assert.equal(missingPermissionAllowed, false);

  const unknownUserAllowed = await appLogic.hasPermission({
    userId: 'unknown-user',
    permissionName: 'rbac.roles.create'
  });
  assert.equal(unknownUserAllowed, false);

  const app = createApp();
  const unauthorized = await app.inject({
    method: 'POST',
    url: '/auth/roles',
    headers: {
      'x-idempotency-key': 'idem-role-create-unauth'
    },
    payload: {
      roleName: 'NOAUTH',
      description: 'No auth request',
      permissionIds: []
    }
  });

  assert.equal(unauthorized.statusCode, 401);
  await app.close();
});

test('get role and list user roles endpoints', async () => {
  const app = createApp();

  const createdRole = await app.inject({
    method: 'POST',
    url: '/auth/roles',
    headers: {
      'x-user-id': 'rbac-admin',
      'x-idempotency-key': 'idem-role-create-3'
    },
    payload: {
      roleName: 'AUDITOR',
      description: 'Audit read role',
      permissionIds: []
    }
  });

  const roleId = createdRole.json().data.roleId;

  const getRole = await app.inject({
    method: 'GET',
    url: `/auth/roles/${roleId}`
  });

  assert.equal(getRole.statusCode, 200);
  assert.equal(getRole.json().data.roleId, roleId);

  await app.inject({
    method: 'POST',
    url: '/auth/assign',
    headers: {
      'x-user-id': 'rbac-admin',
      'x-idempotency-key': 'idem-role-assign-3'
    },
    payload: {
      userId: 'auditor-1',
      roleId
    }
  });

  const listRoles = await app.inject({
    method: 'GET',
    url: '/auth/users/auditor-1/roles'
  });

  assert.equal(listRoles.statusCode, 200);
  assert.equal(listRoles.json().data.userId, 'auditor-1');
  assert.equal(listRoles.json().data.roles.length, 1);

  await app.close();
});

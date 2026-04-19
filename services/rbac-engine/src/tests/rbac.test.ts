import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../app.js';

test('unauthorized blocked', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/auth/roles',
    headers: {
      'x-idempotency-key': 'idem-rbac-unauth-1'
    },
    payload: {
      name: 'VIEWER',
      permissions: ['read.audit']
    }
  });

  assert.equal(response.statusCode, 401);

  await app.close();
});

test('admin can create role and assign role', async () => {
  const app = createApp();

  const createRole = await app.inject({
    method: 'POST',
    url: '/auth/roles',
    headers: {
      'x-user-id': 'rbac-admin',
      'x-idempotency-key': 'idem-rbac-create-1'
    },
    payload: {
      name: 'OPS_VIEWER',
      permissions: ['ops.read.dashboard']
    }
  });

  assert.equal(createRole.statusCode, 200);
  const created = createRole.json();
  assert.equal(created.success, true);

  const assignRole = await app.inject({
    method: 'POST',
    url: '/auth/assign',
    headers: {
      'x-user-id': 'rbac-admin',
      'x-idempotency-key': 'idem-rbac-assign-1'
    },
    payload: {
      userId: 'ops-user-1',
      roleId: created.data.roleId
    }
  });

  assert.equal(assignRole.statusCode, 200);
  const assigned = assignRole.json();
  assert.equal(assigned.success, true);
  assert.equal(assigned.data.userId, 'ops-user-1');

  await app.close();
});

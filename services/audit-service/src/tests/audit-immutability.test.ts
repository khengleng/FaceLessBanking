import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { ImmutableAuditLogError, PostgresAuditAdapter } from '../adapters/postgres-audit.adapter.js';
import { buildAuditEvent, verifyAuditEventChecksum } from '../domain/audit-event.js';

function buildEvent(overrides?: Partial<ReturnType<typeof buildAuditEvent>>) {
  return buildAuditEvent({
    auditId: overrides?.auditId ?? randomUUID(),
    sourceEventId: overrides?.sourceEventId ?? randomUUID(),
    eventType: overrides?.eventType ?? 'payment.status.updated.v1',
    correlationId: overrides?.correlationId ?? 'corr-immutability',
    entityType: overrides?.entityType ?? 'PAYMENT',
    entityId: overrides?.entityId ?? 'pay-immutability',
    payload: overrides?.payload ?? { amount: 100, currency: 'USD' },
    createdAt: overrides?.createdAt ?? new Date().toISOString(),
    actor: overrides?.actor ?? {
      actorId: 'test-suite',
      actorType: 'SYSTEM'
    }
  });
}

test('audit log rejects overwrite by duplicate auditId', async () => {
  const adapter = new PostgresAuditAdapter();
  const auditId = randomUUID();

  await adapter.createAuditEvent(buildEvent({ auditId, sourceEventId: 'source-event-a' }));

  await assert.rejects(
    () => adapter.createAuditEvent(buildEvent({ auditId, sourceEventId: 'source-event-b' })),
    (error: unknown) => {
      assert.equal(error instanceof ImmutableAuditLogError, true);
      return true;
    }
  );
});

test('audit log rejects overwrite by duplicate sourceEventId', async () => {
  const adapter = new PostgresAuditAdapter();
  const sourceEventId = 'source-event-dup';

  await adapter.createAuditEvent(buildEvent({ sourceEventId, entityId: 'pay-1' }));

  await assert.rejects(
    () => adapter.createAuditEvent(buildEvent({ sourceEventId, entityId: 'pay-2' })),
    (error: unknown) => {
      assert.equal(error instanceof ImmutableAuditLogError, true);
      return true;
    }
  );
});

test('returned audit event copies cannot mutate stored audit log records', async () => {
  const adapter = new PostgresAuditAdapter();
  const event = buildEvent({ payload: { amount: 500, currency: 'USD' } });
  await adapter.createAuditEvent(event);

  const firstRead = await adapter.findEventById(event.auditId);
  assert.notEqual(firstRead, null);
  assert.equal(firstRead?.payload.currency, 'USD');

  if (!firstRead) {
    return;
  }

  firstRead.payload.currency = 'KHR';

  const secondRead = await adapter.findEventById(event.auditId);
  assert.equal(secondRead?.payload.currency, 'USD');
});

test('checksum placeholder is set and verification helper validates records', async () => {
  const event = buildEvent({ payload: { amount: 321, currency: 'USD' } });
  assert.ok(event.checksum.length > 0);
  assert.equal(verifyAuditEventChecksum(event), true);

  const tampered = { ...event, payload: { ...event.payload, currency: 'KHR' } };
  assert.equal(verifyAuditEventChecksum(tampered), false);
});

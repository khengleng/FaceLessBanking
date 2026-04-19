import assert from 'node:assert/strict';
import test from 'node:test';

import { InMemoryDerivativesEventAdapter, InMemoryDerivativesPostgresAdapter } from '../adapters/derivatives.adapters.js';
import { DerivativesApplication } from '../application/derivatives.application.js';

function buildHarness() {
  const postgres = new InMemoryDerivativesPostgresAdapter();
  const events = new InMemoryDerivativesEventAdapter();
  const logger = {
    info: (): void => {},
    warn: (): void => {},
    error: (): void => {}
  };

  const application = new DerivativesApplication(postgres, events, logger);

  return { application, events };
}

test('create contract', async () => {
  const { application, events } = buildHarness();

  const contract = await application.createFXForward({
    request: {
      baseCurrency: 'USD',
      quoteCurrency: 'EUR',
      notional: 10000,
      forwardRate: 0.94,
      maturityDate: '2026-12-31T00:00:00.000Z'
    },
    idempotencyKey: 'idem-fx-create-1',
    correlationId: 'corr-fx-create-1'
  });

  assert.equal(contract.status, 'OPEN');
  assert.equal(contract.baseCurrency, 'USD');
  assert.equal(contract.quoteCurrency, 'EUR');
  assert.equal(events.events.length, 1);
  assert.equal(events.events[0]?.type, 'fx.forward.created.v1');
});

test('settle contract at maturity', async () => {
  const { application, events } = buildHarness();

  const contract = await application.createFXForward({
    request: {
      baseCurrency: 'USD',
      quoteCurrency: 'JPY',
      notional: 5000,
      forwardRate: 151.25,
      maturityDate: '2026-01-01T00:00:00.000Z'
    },
    idempotencyKey: 'idem-fx-create-2',
    correlationId: 'corr-fx-create-2'
  });

  const settled = await application.getFXForwardById(contract.contractId, '2026-01-02T00:00:00.000Z');

  assert.ok(settled);
  assert.equal(settled?.status, 'SETTLED');

  const emittedTypes = events.events.map((event) => event.type);
  assert.deepEqual(emittedTypes, ['fx.forward.created.v1', 'fx.forward.settled.v1']);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../app.js';

test('GET /irr/scenarios returns standard scenarios', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'GET',
    url: '/irr/scenarios'
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.success, true);
  assert.equal(body.data.length, 6);
  assert.equal(body.data.some((scenario: { scenarioId: string }) => scenario.scenarioId === 'UP_100_BPS'), true);

  await app.close();
});

test('POST /irr/scenarios/run validates custom scenario request', async () => {
  const app = createApp();

  const noScenarioOrShock = await app.inject({
    method: 'POST',
    url: '/irr/scenarios/run',
    payload: {
      currency: 'USD'
    }
  });
  assert.equal(noScenarioOrShock.statusCode, 400);
  assert.equal(noScenarioOrShock.json().success, false);

  const customWithoutShock = await app.inject({
    method: 'POST',
    url: '/irr/scenarios/run',
    payload: {
      scenarioId: 'CUSTOM_SCENARIO',
      currency: 'USD'
    }
  });
  assert.equal(customWithoutShock.statusCode, 400);
  assert.equal(customWithoutShock.json().success, false);

  await app.close();
});

test('POST /irr/scenarios/run returns deterministic outputs for known sample data', async () => {
  const app = createApp();

  const first = await app.inject({
    method: 'POST',
    url: '/irr/scenarios/run',
    payload: {
      scenarioId: 'UP_100_BPS',
      currency: 'USD'
    }
  });
  assert.equal(first.statusCode, 200);

  const second = await app.inject({
    method: 'POST',
    url: '/irr/scenarios/run',
    payload: {
      scenarioId: 'UP_100_BPS',
      currency: 'USD'
    }
  });
  assert.equal(second.statusCode, 200);

  const firstBody = first.json();
  const secondBody = second.json();

  assert.equal(firstBody.data.niiDelta, '35000');
  assert.equal(secondBody.data.niiDelta, '35000');
  assert.equal(firstBody.data.repricingGapImpact, secondBody.data.repricingGapImpact);

  await app.close();
});

test('GET /irr/scenarios/results/:scenarioId returns persisted scenario result', async () => {
  const app = createApp();

  await app.inject({
    method: 'POST',
    url: '/irr/scenarios/run',
    payload: {
      scenarioId: 'DOWN_100_BPS',
      currency: 'USD'
    }
  });

  const response = await app.inject({
    method: 'GET',
    url: '/irr/scenarios/results/DOWN_100_BPS?currency=USD'
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.success, true);
  assert.equal(body.data.scenarioId, 'DOWN_100_BPS');
  assert.equal(body.data.niiDelta, '-35000');

  await app.close();
});

test('safe handling of empty dataset in scenario execution', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/irr/scenarios/run',
    payload: {
      scenarioId: 'UP_100_BPS',
      currency: 'KHR'
    }
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.success, true);
  assert.equal(body.data.niiDelta, '0');

  await app.close();
});

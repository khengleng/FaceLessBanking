import assert from 'node:assert/strict';
import test from 'node:test';

import type { FxExposureAdapter } from '../adapters/fx-exposure.adapter.js';
import { FxShockApplication } from '../application/fx-shock.application.js';

function logger() {
  return {
    info: (payload: Record<string, unknown>, message: string): void => {
      void payload;
      void message;
    },
    warn: (payload: Record<string, unknown>, message: string): void => {
      void payload;
      void message;
    },
    error: (payload: Record<string, unknown>, message: string): void => {
      void payload;
      void message;
    }
  };
}

function buildExposureAdapter(exposures: Array<{
  currency: string;
  grossAssets: string;
  grossLiabilities: string;
  netOpenPosition: string;
  reportingCurrency?: string;
  reportingValue?: string;
  updatedAt: string;
}>): FxExposureAdapter {
  return {
    getCurrentCurrencyExposures: async () => exposures
  };
}

test('standard scenarios execute correctly', async () => {
  const app = new FxShockApplication(buildExposureAdapter([
    {
      currency: 'USD',
      grossAssets: '1000000',
      grossLiabilities: '500000',
      netOpenPosition: '500000',
      reportingCurrency: 'USD',
      reportingValue: '500000',
      updatedAt: '2026-04-17T00:00:00.000Z'
    },
    {
      currency: 'EUR',
      grossAssets: '2000000',
      grossLiabilities: '500000',
      netOpenPosition: '1500000',
      reportingCurrency: 'USD',
      reportingValue: '1650000',
      updatedAt: '2026-04-17T00:00:00.000Z'
    }
  ]), logger());

  const run = await app.runScenario({
    scenarioId: 'FX_UP_5_PERCENT',
    reportingCurrency: 'USD'
  });

  assert.equal(run.scenario.scenarioId, 'FX_UP_5_PERCENT');
  const eur = run.results.find((row) => row.currency === 'EUR');
  assert.equal(eur?.originalReportingValue, '1650000');
  assert.equal(eur?.shockedReportingValue, '1732500');
  assert.equal(eur?.deltaValue, '82500');
});

test('custom scenario works safely', async () => {
  const app = new FxShockApplication(buildExposureAdapter([
    {
      currency: 'EUR',
      grossAssets: '1000',
      grossLiabilities: '0',
      netOpenPosition: '1000',
      reportingCurrency: 'USD',
      reportingValue: '1200',
      updatedAt: '2026-04-17T00:00:00.000Z'
    }
  ]), logger());

  const run = await app.runScenario({
    shockPercent: -3.5,
    reportingCurrency: 'USD'
  });

  assert.equal(run.scenario.scenarioName, 'Custom FX Shock -3.5%');
  assert.equal(run.results[0]?.shockedReportingValue, '1158');
  assert.equal(run.results[0]?.deltaValue, '-42');
});

test('reporting currency exposure remains unchanged', async () => {
  const app = new FxShockApplication(buildExposureAdapter([
    {
      currency: 'USD',
      grossAssets: '3000',
      grossLiabilities: '1000',
      netOpenPosition: '2000',
      reportingCurrency: 'USD',
      reportingValue: '2000',
      updatedAt: '2026-04-17T00:00:00.000Z'
    }
  ]), logger());

  const run = await app.runScenario({
    scenarioId: 'FX_DOWN_10_PERCENT',
    reportingCurrency: 'USD'
  });

  assert.equal(run.results[0]?.shockedReportingValue, '2000');
  assert.equal(run.results[0]?.deltaValue, '0');
});

test('missing FX rate handled safely', async () => {
  const app = new FxShockApplication(buildExposureAdapter([
    {
      currency: 'KHR',
      grossAssets: '10000',
      grossLiabilities: '0',
      netOpenPosition: '10000',
      reportingCurrency: 'USD',
      reportingValue: undefined,
      updatedAt: '2026-04-17T00:00:00.000Z'
    }
  ]), logger());

  const run = await app.runScenario({
    scenarioId: 'FX_UP_10_PERCENT',
    reportingCurrency: 'USD'
  });

  assert.equal(run.results[0]?.valuationStatus, 'MISSING_RATE');
  assert.equal(run.results[0]?.deltaValue, '0');
  assert.equal(app.getMetrics().missingFxRateErrors, 1);
});

test('deterministic results for sample data', async () => {
  const app = new FxShockApplication(buildExposureAdapter([
    {
      currency: 'EUR',
      grossAssets: '500000',
      grossLiabilities: '200000',
      netOpenPosition: '300000',
      reportingCurrency: 'USD',
      reportingValue: '330000',
      updatedAt: '2026-04-17T00:00:00.000Z'
    }
  ]), logger());

  const first = await app.runScenario({
    scenarioId: 'FX_DOWN_5_PERCENT',
    reportingCurrency: 'USD'
  });
  const second = await app.runScenario({
    scenarioId: 'FX_DOWN_5_PERCENT',
    reportingCurrency: 'USD'
  });

  assert.equal(first.results[0]?.shockedReportingValue, second.results[0]?.shockedReportingValue);
  assert.equal(first.results[0]?.deltaValue, second.results[0]?.deltaValue);
});

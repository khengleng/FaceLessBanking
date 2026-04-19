import assert from 'node:assert/strict';
import test from 'node:test';

import type { FxRateAdapter } from '../adapters/fx-rate.adapter.js';
import type { PostgresExposureAdapter } from '../adapters/postgres-exposure.adapter.js';
import { FxExposureApplication } from '../application/fx-exposure.application.js';

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

test('aggregate exposure by currency', async () => {
  const postgres: PostgresExposureAdapter = {
    fetchLoanAssetPositionsByCurrency: async () => [
      { currency: 'USD', amountCents: 1_000_000n },
      { currency: 'EUR', amountCents: 2_000_000n }
    ],
    fetchDepositLiabilityPositionsByCurrency: async () => [
      { currency: 'USD', amountCents: 500_000n }
    ],
    fetchTreasuryPositionsByCurrency: async () => [
      { currency: 'EUR', amountCents: 100_000n }
    ]
  };

  const fx: FxRateAdapter = {
    getLatestFxRate: async () => null
  };

  const app = new FxExposureApplication(postgres, fx, logger());
  const exposures = await app.getExposures();

  assert.equal(exposures.length, 2);
  const usd = exposures.find((row) => row.currency === 'USD');
  const eur = exposures.find((row) => row.currency === 'EUR');

  assert.equal(usd?.grossAssets, '1000000');
  assert.equal(usd?.grossLiabilities, '500000');
  assert.equal(eur?.grossAssets, '2100000');
  assert.equal(eur?.grossLiabilities, '0');
});

test('calculate net open position correctly', async () => {
  const postgres: PostgresExposureAdapter = {
    fetchLoanAssetPositionsByCurrency: async () => [{ currency: 'USD', amountCents: 1000n }],
    fetchDepositLiabilityPositionsByCurrency: async () => [{ currency: 'USD', amountCents: 1500n }],
    fetchTreasuryPositionsByCurrency: async () => [{ currency: 'USD', amountCents: 200n }]
  };

  const fx: FxRateAdapter = {
    getLatestFxRate: async () => null
  };

  const app = new FxExposureApplication(postgres, fx, logger());
  const usd = await app.getExposureByCurrency('usd');

  assert.ok(usd);
  assert.equal(usd?.netOpenPosition, '-300');
});

test('value exposure into reporting currency', async () => {
  const postgres: PostgresExposureAdapter = {
    fetchLoanAssetPositionsByCurrency: async () => [{ currency: 'EUR', amountCents: 1_000n }],
    fetchDepositLiabilityPositionsByCurrency: async () => [{ currency: 'EUR', amountCents: 0n }],
    fetchTreasuryPositionsByCurrency: async () => []
  };

  const fx: FxRateAdapter = {
    getLatestFxRate: async (baseCurrency, quoteCurrency) => {
      if (baseCurrency === 'EUR' && quoteCurrency === 'USD') {
        return {
          baseCurrency,
          quoteCurrency,
          rateValue: '1.5',
          effectiveAt: '2026-04-17T00:00:00.000Z'
        };
      }

      return null;
    }
  };

  const app = new FxExposureApplication(postgres, fx, logger());
  const eur = await app.getExposureByCurrency('EUR', 'USD');

  assert.ok(eur);
  assert.equal(eur?.reportingCurrency, 'USD');
  assert.equal(eur?.reportingValue, '1500');
});

test('missing FX rate handled safely', async () => {
  const postgres: PostgresExposureAdapter = {
    fetchLoanAssetPositionsByCurrency: async () => [{ currency: 'KHR', amountCents: 10_000n }],
    fetchDepositLiabilityPositionsByCurrency: async () => [],
    fetchTreasuryPositionsByCurrency: async () => []
  };

  const fx: FxRateAdapter = {
    getLatestFxRate: async () => null
  };

  const app = new FxExposureApplication(postgres, fx, logger());
  const khr = await app.getExposureByCurrency('KHR', 'USD');

  assert.ok(khr);
  assert.equal(khr?.reportingValue, undefined);

  const summary = await app.getExposureSummary('USD');
  assert.deepEqual(summary.missingRateCurrencies, ['KHR']);
});

test('empty dataset safe handling', async () => {
  const postgres: PostgresExposureAdapter = {
    fetchLoanAssetPositionsByCurrency: async () => [],
    fetchDepositLiabilityPositionsByCurrency: async () => [],
    fetchTreasuryPositionsByCurrency: async () => []
  };

  const fx: FxRateAdapter = {
    getLatestFxRate: async () => null
  };

  const app = new FxExposureApplication(postgres, fx, logger());
  const exposures = await app.getExposures('USD');

  assert.equal(exposures.length, 0);

  const summary = await app.getExposureSummary('USD');
  assert.equal(summary.totalGrossAssets, '0');
  assert.equal(summary.totalGrossLiabilities, '0');
  assert.equal(summary.totalNetOpenPosition, '0');
  assert.equal(summary.totalReportingValue, '0');
});

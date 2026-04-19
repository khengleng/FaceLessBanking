import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../app.js';
import type { FXRateServiceAdapter, RulesEngineAdapter } from '../adapters/pricing-adapters.js';
import { PricingApplication } from '../application/pricing.application.js';

test('fee calculation correct', async () => {
  const rules: RulesEngineAdapter = {
    getTransferPricingRules: async () => ({ transferType: 'EXTERNAL', flatFee: 1, percentBps: 50 }),
    getFxSpreadRules: async () => ({ spread: 0.001 })
  };

  const fx: FXRateServiceAdapter = {
    getLatestFxRate: async () => ({ rateValue: '1.2' })
  };

  const app = new PricingApplication(rules, fx, {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined
  });

  const result = await app.calculateTransferPricing({
    amount: 100,
    currency: 'USD',
    transferType: 'EXTERNAL'
  });

  // fee = flat(1) + 100 * 0.5% = 1.5
  assert.equal(result.fee, 1.5);
  assert.equal(result.totalAmount, 101.5);
});

test('FX conversion correct', async () => {
  const rules: RulesEngineAdapter = {
    getTransferPricingRules: async () => ({ transferType: 'INTERNAL', flatFee: 0, percentBps: 0 }),
    getFxSpreadRules: async () => ({ spread: 0.005 })
  };

  const fx: FXRateServiceAdapter = {
    getLatestFxRate: async () => ({ rateValue: '1.10' })
  };

  const app = new PricingApplication(rules, fx, {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined
  });

  const result = await app.calculateFXPricing({
    baseCurrency: 'EUR',
    quoteCurrency: 'USD',
    amount: 100
  });

  assert.equal(result.baseRate, 1.1);
  assert.equal(result.spread, 0.005);
  assert.equal(result.finalRate, 1.105);
  assert.equal(result.convertedAmount, 110.5);
});

test('spread applied correctly', async () => {
  const app = createApp();

  const responseSmall = await app.inject({
    method: 'POST',
    url: '/pricing/fx/calculate',
    payload: {
      baseCurrency: 'USD',
      quoteCurrency: 'KHR',
      amount: 500
    }
  });

  assert.equal(responseSmall.statusCode, 200);
  const small = responseSmall.json().data as {
    baseRate: number;
    spread: number;
    finalRate: number;
    convertedAmount: number;
  };
  assert.equal(small.baseRate, 4100);
  assert.equal(small.spread, 0.0025);
  assert.equal(small.finalRate, 4100.0025);
  assert.equal(small.convertedAmount, 2050001.25);

  const responseLarge = await app.inject({
    method: 'POST',
    url: '/pricing/fx/calculate',
    payload: {
      baseCurrency: 'USD',
      quoteCurrency: 'KHR',
      amount: 20000
    }
  });

  assert.equal(responseLarge.statusCode, 200);
  const large = responseLarge.json().data as { spread: number };
  assert.equal(large.spread, 0.0012);

  await app.close();
});

test('edge cases handled', async () => {
  const app = createApp();

  const transferInvalid = await app.inject({
    method: 'POST',
    url: '/pricing/transfers/calculate',
    payload: {
      amount: -1,
      currency: 'USD',
      transferType: 'INTERNAL'
    }
  });
  assert.equal(transferInvalid.statusCode, 400);

  const fxMissingRate = await app.inject({
    method: 'POST',
    url: '/pricing/fx/calculate',
    payload: {
      baseCurrency: 'USD',
      quoteCurrency: 'JPY',
      amount: 100
    }
  });
  assert.equal(fxMissingRate.statusCode, 404);

  await app.close();
});

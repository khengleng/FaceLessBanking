import assert from 'node:assert/strict';
import test from 'node:test';

import { InMemoryFXKafkaAdapter, InMemoryFXPostgresAdapter } from '../adapters/fx-adapters.js';
import { createApp } from '../app.js';
import { FXApplication } from '../application/fx.application.js';

function buildHarness() {
  const postgres = new InMemoryFXPostgresAdapter();
  const kafka = new InMemoryFXKafkaAdapter();
  const logger = {
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

  const application = new FXApplication(postgres, kafka, logger);

  return { application, postgres, kafka };
}

test('create currency', async () => {
  const { application } = buildHarness();

  const currency = await application.createCurrency({
    currencyCode: 'usd',
    currencyName: 'US Dollar',
    decimalPlaces: 2
  });

  assert.equal(currency.currencyCode, 'USD');
  assert.equal(currency.status, 'ACTIVE');
});

test('create FX rate and emit fx.rate.updated.v1', async () => {
  const { application, kafka } = buildHarness();

  await application.createCurrency({ currencyCode: 'USD', currencyName: 'US Dollar', decimalPlaces: 2 });
  await application.createCurrency({ currencyCode: 'EUR', currencyName: 'Euro', decimalPlaces: 2 });

  const rate = await application.submitFxRate({
    baseCurrency: 'USD',
    quoteCurrency: 'EUR',
    rateValue: '0.9300',
    effectiveAt: '2026-04-17T00:00:00.000Z',
    correlationId: 'corr-fx-create-1'
  });

  assert.equal(rate.baseCurrency, 'USD');
  assert.equal(rate.quoteCurrency, 'EUR');
  assert.equal(rate.version, 1);

  assert.equal(kafka.publishedEvents.length, 1);
  assert.equal(kafka.publishedEvents[0]?.type, 'fx.rate.updated.v1');
  assert.equal(kafka.publishedEvents[0]?.metadata.correlationId, 'corr-fx-create-1');
  assert.equal(kafka.publishedEvents[0]?.payload.rateId, rate.rateId);
});

test('get latest rate', async () => {
  const { application } = buildHarness();

  await application.createCurrency({ currencyCode: 'USD', currencyName: 'US Dollar', decimalPlaces: 2 });
  await application.createCurrency({ currencyCode: 'EUR', currencyName: 'Euro', decimalPlaces: 2 });

  await application.submitFxRate({
    baseCurrency: 'USD',
    quoteCurrency: 'EUR',
    rateValue: '0.9200',
    effectiveAt: '2026-04-17T00:00:00.000Z'
  });

  await application.submitFxRate({
    baseCurrency: 'USD',
    quoteCurrency: 'EUR',
    rateValue: '0.9400',
    effectiveAt: '2026-04-17T06:00:00.000Z'
  });

  const latest = await application.getLatestFxRate('USD', 'EUR');
  assert.ok(latest);
  assert.equal(latest?.rateValue, '0.9400');
  assert.equal(latest?.version, 2);
});

test('duplicate rate handled safely', async () => {
  const { application, kafka } = buildHarness();

  await application.createCurrency({ currencyCode: 'USD', currencyName: 'US Dollar', decimalPlaces: 2 });
  await application.createCurrency({ currencyCode: 'EUR', currencyName: 'Euro', decimalPlaces: 2 });

  const effectiveAt = '2026-04-17T03:00:00.000Z';

  const first = await application.submitFxRate({
    baseCurrency: 'USD',
    quoteCurrency: 'EUR',
    rateValue: '0.9333',
    effectiveAt
  });

  const second = await application.submitFxRate({
    baseCurrency: 'USD',
    quoteCurrency: 'EUR',
    rateValue: '0.9333',
    effectiveAt
  });

  assert.equal(first.rateId, second.rateId);
  assert.equal(kafka.publishedEvents.length, 1);
});

test('invalid currency pair rejected', async () => {
  const { application } = buildHarness();

  await application.createCurrency({ currencyCode: 'USD', currencyName: 'US Dollar', decimalPlaces: 2 });

  await assert.rejects(
    application.submitFxRate({
      baseCurrency: 'USD',
      quoteCurrency: 'JPY',
      rateValue: '150.00',
      effectiveAt: '2026-04-17T00:00:00.000Z'
    }),
    /currency_not_found/
  );
});

test('HTTP GET latest returns not found safely when pair missing', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'GET',
    url: '/fx/rates/latest?base=USD&quote=EUR'
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().success, false);

  await app.close();
});

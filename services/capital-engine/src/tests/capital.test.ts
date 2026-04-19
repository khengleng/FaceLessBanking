import assert from 'node:assert/strict';
import test from 'node:test';

import { InMemoryBalanceDataAdapter, InMemoryLoanDataAdapter } from '../adapters/capital.adapters.js';
import { CapitalApplication } from '../application/capital.application.js';

function buildHarness() {
  const loanAdapter = new InMemoryLoanDataAdapter();
  const balanceAdapter = new InMemoryBalanceDataAdapter();
  const logger = {
    info: (): void => {},
    warn: (): void => {},
    error: (): void => {}
  };
  const application = new CapitalApplication(loanAdapter, balanceAdapter, logger);

  return { application, loanAdapter, balanceAdapter };
}

test('RWA calculation', async () => {
  const { application, loanAdapter } = buildHarness();
  loanAdapter.setLoanExposures('USD', [
    { assetType: 'LOAN_SECURED', exposure: 1000, currency: 'USD' },
    { assetType: 'LOAN_UNSECURED', exposure: 1000, currency: 'USD' }
  ]);

  const rwa = await application.getRWA('USD');
  assert.equal(rwa.rows.length, 2);
  assert.equal(rwa.rows[0]?.rwaValue, 500);
  assert.equal(rwa.rows[1]?.rwaValue, 1000);
  assert.equal(rwa.totalRwa, 1500);
});

test('CAR calculation', async () => {
  const { application, loanAdapter, balanceAdapter } = buildHarness();
  loanAdapter.setLoanExposures('USD', [
    { assetType: 'LOAN_RETAIL', exposure: 800, currency: 'USD' }
  ]);
  balanceAdapter.setCapitalBase('USD', 600);

  const car = await application.getCAR('USD');
  assert.equal(car.totalRwa, 600);
  assert.equal(car.capital, 600);
  assert.equal(car.car, 1);
});

test('edge cases handled for divide-by-zero', async () => {
  const { application, loanAdapter, balanceAdapter } = buildHarness();
  loanAdapter.setLoanExposures('USD', []);
  balanceAdapter.setCapitalBase('USD', 500);

  const car = await application.getCAR('USD');
  assert.equal(car.totalRwa, 0);
  assert.equal(car.car, null);
});

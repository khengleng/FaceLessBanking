import assert from 'node:assert/strict';
import test from 'node:test';

import { IslamicBankingApplication } from '../application/islamic-banking.application.js';

test('murabaha calculation', () => {
  const logger = {
    info: (): void => {},
    warn: (): void => {},
    error: (): void => {}
  };

  const application = new IslamicBankingApplication(logger);

  const result = application.calculateMurabaha({
    assetCost: 1000,
    markup: 150
  });

  assert.equal(result.assetCost, 1000);
  assert.equal(result.markup, 150);
  assert.equal(result.sellingPrice, 1150);
});

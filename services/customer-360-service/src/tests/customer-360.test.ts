import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../app.js';

test('full aggregation works', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'GET',
    url: '/customer-360/cust-001'
  });

  assert.equal(response.statusCode, 200);

  const body = response.json() as {
    success: boolean;
    data: {
      customerId: string;
      profile: {
        customerId: string;
        status: string;
        onboardingReference: string | null;
        verificationStatus: string;
        createdAt: string | null;
      };
      onboardingStatus: {
        caseStatus: string;
        ekycStatus: string;
        lastUpdatedAt: string | null;
      };
      accounts: Array<{ accountId: string }>;
      loans: Array<{ loanId: string }>;
      transactions: Array<{ transactionId: string }>;
      profitability: {
        totalRevenue: number;
        totalCost: number;
        netProfit: number;
        currency: string;
      };
    };
  };

  assert.equal(body.success, true);
  assert.equal(body.data.customerId, 'cust-001');
  assert.equal(body.data.profile.customerId, 'cust-001');
  assert.equal(body.data.profile.status, 'ACTIVE');
  assert.equal(body.data.onboardingStatus.caseStatus, 'APPROVED');
  assert.equal(body.data.onboardingStatus.ekycStatus, 'APPROVED');
  assert.equal(body.data.accounts.length, 1);
  assert.equal(body.data.accounts[0]?.accountId, 'acc-001');
  assert.equal(body.data.loans.length, 1);
  assert.equal(body.data.loans[0]?.loanId, 'loan-001');
  assert.equal(body.data.transactions.length, 2);
  assert.equal(body.data.transactions[0]?.transactionId, 'txn-001');
  assert.equal(body.data.profitability.totalRevenue, 120);
  assert.equal(body.data.profitability.totalCost, 20);
  assert.equal(body.data.profitability.netProfit, 100);
  assert.equal(body.data.profitability.currency, 'USD');

  await app.close();
});

test('missing partial data handled safely', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'GET',
    url: '/customer-360/cust-missing'
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as {
    success: boolean;
    data: {
      customerId: string;
      profile: {
        status: string;
      };
      onboardingStatus: {
        caseStatus: string;
        ekycStatus: string;
      };
      accounts: unknown[];
      loans: unknown[];
      transactions: unknown[];
      profitability: {
        totalRevenue: number;
        totalCost: number;
        netProfit: number;
      };
    };
  };

  assert.equal(body.success, true);
  assert.equal(body.data.customerId, 'cust-missing');
  assert.equal(body.data.profile.status, 'UNKNOWN');
  assert.equal(body.data.onboardingStatus.caseStatus, 'UNKNOWN');
  assert.equal(body.data.onboardingStatus.ekycStatus, 'UNKNOWN');
  assert.equal(body.data.accounts.length, 0);
  assert.equal(body.data.loans.length, 0);
  assert.equal(body.data.transactions.length, 0);
  assert.equal(body.data.profitability.totalRevenue, 0);
  assert.equal(body.data.profitability.totalCost, 0);
  assert.equal(body.data.profitability.netProfit, 0);

  await app.close();
});

test('safe response shape enforced', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'GET',
    url: '/customer-360/cust-001'
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as {
    data: Record<string, unknown>;
  };

  const topLevelKeys = Object.keys(body.data).sort();
  assert.deepEqual(topLevelKeys, [
    'accounts',
    'customerId',
    'generatedAt',
    'loans',
    'onboardingStatus',
    'profile',
    'profitability',
    'transactions'
  ]);

  const profile = body.data.profile as Record<string, unknown>;
  const profileKeys = Object.keys(profile).sort();
  assert.deepEqual(profileKeys, [
    'createdAt',
    'customerId',
    'onboardingReference',
    'status',
    'verificationStatus'
  ]);
  assert.equal(profile.rawKycDocument, undefined);
  assert.equal(profile.accessToken, undefined);

  await app.close();
});

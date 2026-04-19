import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AllowAllWorkflowAdapter,
  InMemoryAccountingAdapter,
  InMemoryBalanceAdapter,
  InMemoryKafkaTradeFinanceAdapter,
  InMemoryPostgresTradeFinanceAdapter
} from '../adapters/trade-finance.adapters.js';
import { TradeFinanceApplication } from '../application/trade-finance.application.js';

function buildHarness() {
  const postgres = new InMemoryPostgresTradeFinanceAdapter();
  const workflow = new AllowAllWorkflowAdapter();
  const accounting = new InMemoryAccountingAdapter();
  const balance = new InMemoryBalanceAdapter();
  const kafka = new InMemoryKafkaTradeFinanceAdapter();
  const logger = {
    info: (): void => {},
    warn: (): void => {},
    error: (): void => {}
  };

  const application = new TradeFinanceApplication(postgres, workflow, accounting, balance, kafka, logger);

  return {
    application,
    workflow,
    accounting,
    balance,
    kafka
  };
}

test('lifecycle transitions APPLICATION -> APPROVED -> ISSUED -> SETTLED', async () => {
  const { application, workflow, accounting, balance, kafka } = buildHarness();

  const lc = await application.createLC({
    request: {
      applicant: 'applicant-1',
      beneficiary: 'beneficiary-1',
      amount: 5000,
      currency: 'USD'
    },
    idempotencyKey: 'idem-create-1',
    correlationId: 'corr-lc-1'
  });

  assert.equal(lc.status, 'APPLICATION');

  const approved = await application.approveLC({
    lcId: lc.lcId,
    idempotencyKey: 'idem-approve-1',
    correlationId: 'corr-lc-1'
  });

  assert.equal(approved.status, 'APPROVED');
  assert.equal(workflow.checks, 1);

  const issued = await application.issueLC({
    lcId: lc.lcId,
    idempotencyKey: 'idem-issue-1',
    correlationId: 'corr-lc-1'
  });

  assert.equal(issued.status, 'ISSUED');
  assert.equal(accounting.issuedEntries.length, 1);

  const settled = await application.settleLC({
    lcId: lc.lcId,
    idempotencyKey: 'idem-settle-1',
    correlationId: 'corr-lc-1'
  });

  assert.equal(settled.status, 'SETTLED');
  assert.equal(balance.settlements.length, 1);

  const eventTypes = kafka.events.map((event) => event.type);
  assert.deepEqual(eventTypes, ['lc.created.v1', 'lc.issued.v1', 'lc.settled.v1']);
});

test('invalid transitions are blocked', async () => {
  const { application } = buildHarness();

  const lc = await application.createLC({
    request: {
      applicant: 'applicant-2',
      beneficiary: 'beneficiary-2',
      amount: 1000,
      currency: 'USD'
    },
    idempotencyKey: 'idem-create-2',
    correlationId: 'corr-lc-2'
  });

  await assert.rejects(
    application.issueLC({
      lcId: lc.lcId,
      idempotencyKey: 'idem-issue-invalid',
      correlationId: 'corr-lc-2'
    }),
    /invalid_transition/
  );

  await application.approveLC({
    lcId: lc.lcId,
    idempotencyKey: 'idem-approve-2',
    correlationId: 'corr-lc-2'
  });

  await application.issueLC({
    lcId: lc.lcId,
    idempotencyKey: 'idem-issue-2',
    correlationId: 'corr-lc-2'
  });

  await application.settleLC({
    lcId: lc.lcId,
    idempotencyKey: 'idem-settle-2',
    correlationId: 'corr-lc-2'
  });

  await assert.rejects(
    application.approveLC({
      lcId: lc.lcId,
      idempotencyKey: 'idem-approve-after-settle',
      correlationId: 'corr-lc-2'
    }),
    /invalid_transition/
  );
});

test('idempotent create and transition requests return prior result safely', async () => {
  const { application, accounting } = buildHarness();

  const first = await application.createLC({
    request: {
      applicant: 'applicant-3',
      beneficiary: 'beneficiary-3',
      amount: 900,
      currency: 'USD'
    },
    idempotencyKey: 'idem-create-3',
    correlationId: 'corr-lc-3'
  });

  const second = await application.createLC({
    request: {
      applicant: 'other-applicant',
      beneficiary: 'other-beneficiary',
      amount: 100,
      currency: 'EUR'
    },
    idempotencyKey: 'idem-create-3',
    correlationId: 'corr-lc-3'
  });

  assert.equal(first.lcId, second.lcId);

  await application.approveLC({
    lcId: first.lcId,
    idempotencyKey: 'idem-approve-3',
    correlationId: 'corr-lc-3'
  });

  const issueFirst = await application.issueLC({
    lcId: first.lcId,
    idempotencyKey: 'idem-issue-3',
    correlationId: 'corr-lc-3'
  });

  const issueSecond = await application.issueLC({
    lcId: first.lcId,
    idempotencyKey: 'idem-issue-3',
    correlationId: 'corr-lc-3'
  });

  assert.equal(issueFirst.status, 'ISSUED');
  assert.equal(issueSecond.status, 'ISSUED');
  assert.equal(accounting.issuedEntries.length, 1);
});

import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { PostgresEkycAdapter } from '../adapters/postgres-ekyc.adapter.js';
import type { SumsubWebhookVerifierAdapter } from '../adapters/sumsub-webhook-verifier.adapter.js';
import { SumsubWebhookVerifierAdapterPlaceholder } from '../adapters/sumsub-webhook-verifier.adapter.js';
import { SumsubWebhookApplication } from '../application/sumsub-webhook.application.js';
import { createApp } from '../app.js';
import { buildEkycSession } from '../domain/ekyc-session.js';
import { EkycEventsPublisher } from '../events/ekyc.events.js';
import { EkycWebhookMetrics } from '../events/metrics.js';

function buildHarness(verifier: SumsubWebhookVerifierAdapter) {
  const postgresAdapter = new PostgresEkycAdapter();
  const kafkaProducer = new KafkaProducerAdapter();
  const eventsPublisher = new EkycEventsPublisher(kafkaProducer);
  const metrics = new EkycWebhookMetrics();

  const application = new SumsubWebhookApplication(
    postgresAdapter,
    verifier,
    eventsPublisher,
    metrics,
    {
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
    }
  );

  return {
    application,
    postgresAdapter,
    kafkaProducer,
    metrics
  };
}

test('valid Sumsub webhook updates session status and emits ekyc.status.updated.v1', async () => {
  const harness = buildHarness({
    verifySignature: () => ({ valid: true })
  });

  const session = buildEkycSession({
    sessionId: 'sess-1',
    customerId: 'cust-1',
    countryCode: 'KH',
    createdAt: new Date().toISOString()
  });

  await harness.postgresAdapter.insertSession({
    ...session,
    sumsubApplicantId: 'sumsub-applicant-1'
  });

  const result = await harness.application.processWebhook({
    headers: {},
    rawBody: '{}',
    payload: {
      applicantId: 'sumsub-applicant-1',
      inspectionId: 'insp-1',
      type: 'basic-level',
      reviewStatus: 'completed',
      reviewResult: {
        reviewAnswer: 'GREEN'
      }
    }
  });

  assert.equal(result.kind, 'processed');

  const updated = await harness.postgresAdapter.getEkycSessionBySumsubApplicantId('sumsub-applicant-1');
  assert.equal(updated?.status, 'APPROVED');
  assert.equal(updated?.reviewResult, 'GREEN');

  assert.equal(harness.kafkaProducer.events.length, 1);
  assert.equal(harness.kafkaProducer.events[0]?.type, 'ekyc.status.updated.v1');
  assert.equal(harness.kafkaProducer.events[0]?.payload.newStatus, 'APPROVED');
  assert.equal(harness.metrics.ekycStatusUpdatesEmitted, 1);
});

test('duplicate webhook does not process twice', async () => {
  const harness = buildHarness({
    verifySignature: () => ({ valid: true })
  });

  const session = buildEkycSession({
    sessionId: 'sess-dup',
    customerId: 'cust-dup',
    countryCode: 'KH',
    createdAt: new Date().toISOString()
  });

  await harness.postgresAdapter.insertSession({
    ...session,
    sumsubApplicantId: 'sumsub-applicant-dup'
  });

  const input = {
    headers: {},
    rawBody: '{}',
    payload: {
      applicantId: 'sumsub-applicant-dup',
      inspectionId: 'insp-dup',
      type: 'basic-level',
      reviewStatus: 'completed',
      reviewResult: {
        reviewAnswer: 'GREEN'
      }
    }
  };

  const first = await harness.application.processWebhook(input);
  assert.equal(first.kind, 'processed');

  const second = await harness.application.processWebhook(input);
  assert.equal(second.kind, 'duplicate');

  assert.equal(harness.kafkaProducer.events.length, 1);
  assert.equal(harness.metrics.duplicateWebhooksSkipped, 1);
});

test('malformed webhook payload is rejected safely', async () => {
  const harness = buildHarness({
    verifySignature: () => ({ valid: true })
  });

  const result = await harness.application.processWebhook({
    headers: {},
    rawBody: '{}',
    payload: {
      inspectionId: 'missing-applicant'
    }
  });

  assert.equal(result.kind, 'invalid_payload');
});

test('POST /webhooks/sumsub rejects invalid signature', async () => {
  const secret = process.env.SUMSUB_WEBHOOK_SECRET;
  process.env.SUMSUB_WEBHOOK_SECRET = 'test-secret';

  const app = createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/webhooks/sumsub',
    headers: {
      'x-sumsub-signature': 'invalid-signature'
    },
    payload: {
      applicantId: 'sumsub-applicant-1',
      reviewStatus: 'pending'
    }
  });

  assert.equal(response.statusCode, 401);
  await app.close();

  if (secret === undefined) {
    delete process.env.SUMSUB_WEBHOOK_SECRET;
  } else {
    process.env.SUMSUB_WEBHOOK_SECRET = secret;
  }
});

test('POST /webhooks/sumsub processes approved review and updates session', async () => {
  const previous = process.env.SUMSUB_WEBHOOK_SECRET;
  process.env.SUMSUB_WEBHOOK_SECRET = 'test-secret';

  const app = createApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/ekyc/sessions',
    payload: {
      customerId: 'cust-webhook-1',
      countryCode: 'KH'
    }
  });

  assert.equal(createResponse.statusCode, 201);
  const created = createResponse.json() as { sessionId: string; sumsubApplicantId: string };

  const webhookPayload = {
    applicantId: created.sumsubApplicantId,
    inspectionId: 'insp-approved-1',
    type: 'basic-level',
    reviewStatus: 'completed',
    reviewResult: {
      reviewAnswer: 'GREEN'
    }
  };

  const rawBody = JSON.stringify(webhookPayload);
  const signature = createHmac('sha256', process.env.SUMSUB_WEBHOOK_SECRET).update(rawBody).digest('hex');

  const webhookResponse = await app.inject({
    method: 'POST',
    url: '/webhooks/sumsub',
    headers: {
      'x-sumsub-signature': signature,
      'x-correlation-id': 'corr-sumsub-approve-1'
    },
    payload: webhookPayload
  });

  assert.equal(webhookResponse.statusCode, 200);

  const sessionResponse = await app.inject({
    method: 'GET',
    url: `/ekyc/sessions/${created.sessionId}`
  });

  assert.equal(sessionResponse.statusCode, 200);
  const session = sessionResponse.json() as { status: string; reviewResult?: string; verificationLevel?: string };

  assert.equal(session.status, 'APPROVED');
  assert.equal(session.reviewResult, 'GREEN');
  assert.equal(session.verificationLevel, 'basic-level');

  await app.close();

  if (previous === undefined) {
    delete process.env.SUMSUB_WEBHOOK_SECRET;
  } else {
    process.env.SUMSUB_WEBHOOK_SECRET = previous;
  }
});

// Ensures the placeholder verifier can still be imported and used.
test('Sumsub signature verifier placeholder can validate deterministic signature', () => {
  const previous = process.env.SUMSUB_WEBHOOK_SECRET;
  process.env.SUMSUB_WEBHOOK_SECRET = 'test-secret';

  const verifier = new SumsubWebhookVerifierAdapterPlaceholder();
  const rawBody = JSON.stringify({ hello: 'world' });
  const signature = createHmac('sha256', 'test-secret').update(rawBody).digest('hex');

  const result = verifier.verifySignature({ 'x-sumsub-signature': signature }, rawBody);
  assert.equal(result.valid, true);

  if (previous === undefined) {
    delete process.env.SUMSUB_WEBHOOK_SECRET;
  } else {
    process.env.SUMSUB_WEBHOOK_SECRET = previous;
  }
});

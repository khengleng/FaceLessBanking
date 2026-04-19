import assert from 'node:assert/strict';
import test from 'node:test';

import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { createApp } from '../app.js';
import { buildEkycSession } from '../domain/ekyc-session.js';
import { EkycEventsPublisher } from '../events/ekyc.events.js';

test('POST /ekyc/sessions creates session', async () => {
  const app = createApp();

  const response = await app.inject({
    method: 'POST',
    url: '/ekyc/sessions',
    payload: {
      customerId: 'cust-123',
      countryCode: 'KH'
    }
  });

  assert.equal(response.statusCode, 201);

  const payload = response.json() as {
    sessionId: string;
    status: string;
    amlResult: string;
  };

  assert.ok(payload.sessionId.length > 0);
  assert.equal(payload.status, 'session_created');
  assert.equal(payload.amlResult, 'clear');

  await app.close();
});

test('POST /ekyc/sessions/:sessionId/documents uploads documents', async () => {
  const app = createApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/ekyc/sessions',
    payload: {
      customerId: 'cust-456',
      countryCode: 'KH'
    }
  });

  assert.equal(createResponse.statusCode, 201);
  const created = createResponse.json() as { sessionId: string };

  const uploadResponse = await app.inject({
    method: 'POST',
    url: `/ekyc/sessions/${created.sessionId}/documents`,
    payload: {
      documents: [
        {
          type: 'national_id_front',
          fileReference: 'doc://front-1'
        }
      ]
    }
  });

  assert.equal(uploadResponse.statusCode, 200);

  const payload = uploadResponse.json() as {
    sessionId: string;
    status: string;
    ocrResult: string;
    documentIds: string[];
  };

  assert.equal(payload.sessionId, created.sessionId);
  assert.equal(payload.status, 'documents_submitted');
  assert.equal(payload.ocrResult, 'passed');
  assert.ok(payload.documentIds.length > 0);

  await app.close();
});

test('POST /ekyc/sessions/:sessionId/liveness submits liveness', async () => {
  const app = createApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/ekyc/sessions',
    payload: {
      customerId: 'cust-789',
      countryCode: 'KH'
    }
  });

  assert.equal(createResponse.statusCode, 201);
  const created = createResponse.json() as { sessionId: string };

  const livenessResponse = await app.inject({
    method: 'POST',
    url: `/ekyc/sessions/${created.sessionId}/liveness`,
    payload: {
      selfieReference: 'img://selfie-1',
      challengeToken: 'challenge-abc'
    }
  });

  assert.equal(livenessResponse.statusCode, 200);

  const payload = livenessResponse.json() as {
    sessionId: string;
    status: string;
    livenessResult: string;
  };

  assert.equal(payload.sessionId, created.sessionId);
  assert.equal(payload.status, 'liveness_submitted');
  assert.equal(payload.livenessResult, 'passed');

  await app.close();
});

test('GET /ekyc/sessions/:sessionId returns ekyc session status', async () => {
  const app = createApp();

  const createResponse = await app.inject({
    method: 'POST',
    url: '/ekyc/sessions',
    payload: {
      customerId: 'cust-999',
      countryCode: 'KH'
    }
  });

  assert.equal(createResponse.statusCode, 201);
  const created = createResponse.json() as { sessionId: string; customerId: string };

  const getResponse = await app.inject({
    method: 'GET',
    url: `/ekyc/sessions/${created.sessionId}`
  });

  assert.equal(getResponse.statusCode, 200);

  const payload = getResponse.json() as {
    sessionId: string;
    customerId: string;
  };

  assert.equal(payload.sessionId, created.sessionId);
  assert.equal(payload.customerId, 'cust-999');

  await app.close();
});

test('invalid payloads are rejected', async () => {
  const app = createApp();

  const createInvalid = await app.inject({
    method: 'POST',
    url: '/ekyc/sessions',
    payload: {
      customerId: 'x',
      countryCode: 'KHM'
    }
  });
  assert.equal(createInvalid.statusCode, 400);

  const createValid = await app.inject({
    method: 'POST',
    url: '/ekyc/sessions',
    payload: {
      customerId: 'cust-abc',
      countryCode: 'KH'
    }
  });
  assert.equal(createValid.statusCode, 201);
  const created = createValid.json() as { sessionId: string };

  const docInvalid = await app.inject({
    method: 'POST',
    url: `/ekyc/sessions/${created.sessionId}/documents`,
    payload: {
      documents: []
    }
  });
  assert.equal(docInvalid.statusCode, 400);

  const livenessInvalid = await app.inject({
    method: 'POST',
    url: `/ekyc/sessions/${created.sessionId}/liveness`,
    payload: {
      selfieReference: '',
      challengeToken: 'x'
    }
  });
  assert.equal(livenessInvalid.statusCode, 400);

  await app.close();
});

test('ekyc.status.updated.v1 event is constructed and published with canonical envelope', async () => {
  const kafkaProducer = new KafkaProducerAdapter();
  const publisher = new EkycEventsPublisher(kafkaProducer);

  const session = buildEkycSession({
    sessionId: 'ekyc-evt-1',
    customerId: 'cust-evt-1',
    countryCode: 'KH',
    createdAt: new Date().toISOString()
  });

  await publisher.emitStatusUpdated(session);

  assert.equal(kafkaProducer.events.length, 1);
  assert.equal(kafkaProducer.events[0]?.type, 'ekyc.status.updated.v1');
  assert.equal(kafkaProducer.events[0]?.version, 1);
  assert.equal(kafkaProducer.events[0]?.metadata.producer, 'ekyc-orchestration');
  assert.equal(kafkaProducer.events[0]?.payload.sessionId, session.sessionId);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';

import { createApp } from '../app.js';
import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';

const opsHeaders = {
  'x-internal-ops-role': 'ops',
  'x-internal-ops-actor-id': 'ops-user-101',
  'x-correlation-id': 'corr-customer-ops-101'
};

type StoredCustomer = {
  customer_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  date_of_birth?: string;
  onboarding_reference?: string;
  source_entity_id?: string;
  provider_reference?: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type StoredProfile = {
  customer_id: string;
  display_name?: string;
  onboarding_reference?: string;
  verification_status: string;
  risk_level: string;
  country_code?: string;
  contact_status: string;
  created_at: string;
  updated_at: string;
};

function buildHarness() {
  const customers = new Map<string, StoredCustomer>();
  const profiles = new Map<string, StoredProfile>();

  const mockDb = {
    query: async (text: string, params: unknown[] = []) => {
      if (text.includes('INSERT INTO customers')) {
        const customer: StoredCustomer = {
          customer_id: String(params[0]),
          first_name: String(params[1]),
          last_name: String(params[2]),
          email: String(params[3]),
          phone_number: typeof params[4] === 'string' ? params[4] : undefined,
          date_of_birth: typeof params[5] === 'string' ? params[5] : undefined,
          onboarding_reference: typeof params[6] === 'string' ? params[6] : undefined,
          source_entity_id: typeof params[7] === 'string' ? params[7] : undefined,
          provider_reference: typeof params[8] === 'string' ? params[8] : undefined,
          status: String(params[9]),
          created_at: String(params[10]),
          updated_at: String(params[11])
        };
        customers.set(customer.customer_id, customer);
        return { rowCount: 1, rows: [] };
      }

      if (text.includes('SELECT * FROM customers WHERE customer_id =')) {
        const customer = customers.get(String(params[0]));
        return customer
          ? { rowCount: 1, rows: [customer] }
          : { rowCount: 0, rows: [] };
      }

      if (text.includes('SELECT * FROM customers') && text.includes('ORDER BY created_at DESC')) {
        let rows = Array.from(customers.values());
        const customerIdFilter = params.find((value) => typeof value === 'string' && customers.has(value));
        const onboardingFilter = params.find((value) =>
          typeof value === 'string'
          && Array.from(customers.values()).some((item) => item.onboarding_reference === value)
        );

        if (typeof customerIdFilter === 'string') {
          rows = rows.filter((item) => item.customer_id === customerIdFilter);
        }

        if (typeof onboardingFilter === 'string') {
          rows = rows.filter((item) => item.onboarding_reference === onboardingFilter);
        }

        rows = rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
        const offset = Number(params[params.length - 1] ?? 0);
        const limit = Number(params[params.length - 2] ?? 50);
        return { rowCount: rows.length, rows: rows.slice(offset, offset + limit) };
      }

      if (text.includes('SELECT * FROM customer_profiles WHERE customer_id =')) {
        const profile = profiles.get(String(params[0]));
        return profile
          ? { rowCount: 1, rows: [profile] }
          : { rowCount: 0, rows: [] };
      }

      if (text.includes('INSERT INTO customer_profiles')) {
        const profile: StoredProfile = {
          customer_id: String(params[0]),
          display_name: typeof params[1] === 'string' ? params[1] : undefined,
          onboarding_reference: typeof params[2] === 'string' ? params[2] : undefined,
          verification_status: String(params[3]),
          risk_level: String(params[4]),
          country_code: typeof params[5] === 'string' ? params[5] : undefined,
          contact_status: String(params[6]),
          created_at: String(params[7]),
          updated_at: String(params[8])
        };
        profiles.set(profile.customer_id, profile);
        return { rowCount: 1, rows: [] };
      }

      if (text.includes('SELECT 1 FROM processed_customer_creation_events')) {
        return { rowCount: 0, rows: [] };
      }

      if (text.includes('SELECT 1 FROM processed_customer_profile_events')) {
        return { rowCount: 0, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    }
  };

  const mockRedis = {
    data: new Map<string, string>(),
    get: async (key: string) => mockRedis.data.get(key) ?? null,
    set: async (key: string, value: string, ...args: unknown[]) => {
      void args;
      mockRedis.data.set(key, value);
    }
  };

  return { mockDb, mockRedis };
}

test('GET /health returns health payload', async () => {
  const { mockDb, mockRedis } = buildHarness();
  const app = createApp({ db: mockDb, redis: mockRedis });

  const response = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(response.statusCode, 200);

  const payload = response.json();
  assert.equal(payload.status, 'ok');
  assert.equal(payload.service, 'customer-service');

  await app.close();
});

test('POST /customers creates customer on happy path', async () => {
  const { mockDb, mockRedis } = buildHarness();
  const app = createApp({ db: mockDb, redis: mockRedis });

  const response = await app.inject({
    method: 'POST',
    url: '/customers',
    headers: {
      'x-idempotency-key': `idem-${randomUUID()}`
    },
    payload: {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@example.com'
    }
  });

  assert.equal(response.statusCode, 201);

  const payload = response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.firstName, 'Jane');
  assert.equal(payload.data.status, 'pending_kyc');

  await app.close();
});

test('POST /customers rejects invalid payload', async () => {
  const { mockDb, mockRedis } = buildHarness();
  const app = createApp({ db: mockDb, redis: mockRedis });

  const response = await app.inject({
    method: 'POST',
    url: '/customers',
    headers: {
      'x-idempotency-key': 'idem-invalid'
    },
    payload: {
      firstName: 'J',
      lastName: '',
      email: 'not-an-email'
    }
  });

  assert.equal(response.statusCode, 400);
  const payload = response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, 'validation_failed');
  assert.ok(payload.error.details.length > 0);

  await app.close();
});

test('POST /customers enforces idempotency', async () => {
  const { mockDb, mockRedis } = buildHarness();
  const app = createApp({ db: mockDb, redis: mockRedis });
  const idempotencyKey = `idem-dup-${randomUUID()}`;

  const firstResponse = await app.inject({
    method: 'POST',
    url: '/customers',
    headers: { 'x-idempotency-key': idempotencyKey },
    payload: {
      firstName: 'Sam',
      lastName: 'Lee',
      email: 'sam.lee@example.com'
    }
  });
  assert.equal(firstResponse.statusCode, 201);

  const secondResponse = await app.inject({
    method: 'POST',
    url: '/customers',
    headers: { 'x-idempotency-key': idempotencyKey },
    payload: {
      firstName: 'Sam',
      lastName: 'Lee',
      email: 'sam.lee@example.com'
    }
  });

  assert.equal(secondResponse.statusCode, 409);
  const payload = secondResponse.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, 'conflict');

  await app.close();
});

test('GET /customers requires internal ops auth placeholder', async () => {
  const { mockDb, mockRedis } = buildHarness();
  const app = createApp({ db: mockDb, redis: mockRedis });

  const response = await app.inject({ method: 'GET', url: '/customers' });
  assert.equal(response.statusCode, 403);

  const payload = response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, 'forbidden');

  await app.close();
});

test('GET /customers returns filtered paginated response', async () => {
  const { mockDb, mockRedis } = buildHarness();
  const app = createApp({ db: mockDb, redis: mockRedis });

  await app.inject({
    method: 'POST',
    url: '/customers',
    headers: { 'x-idempotency-key': 'idem-list-1' },
    payload: { firstName: 'Al', lastName: 'One', email: 'a.one@example.com' }
  });
  await app.inject({
    method: 'POST',
    url: '/customers',
    headers: { 'x-idempotency-key': 'idem-list-2' },
    payload: { firstName: 'Bo', lastName: 'Two', email: 'b.two@example.com' }
  });

  const created = await app.inject({
    method: 'POST',
    url: '/customers',
    headers: { 'x-idempotency-key': 'idem-list-3' },
    payload: { firstName: 'Cara', lastName: 'Three', email: 'c.three@example.com' }
  });
  const createdPayload = created.json();

  const response = await app.inject({
    method: 'GET',
    url: `/customers?customerId=${createdPayload.data.customerId}&limit=10&offset=0`,
    headers: opsHeaders
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.meta.limit, 10);
  assert.equal(payload.meta.offset, 0);
  assert.equal(payload.meta.filtered, true);
  assert.equal(payload.data.items.length, 1);
  assert.equal(payload.data.items[0].customerId, createdPayload.data.customerId);

  await app.close();
});

test('GET /customers/:customerId returns customer', async () => {
  const { mockDb, mockRedis } = buildHarness();
  const app = createApp({ db: mockDb, redis: mockRedis });

  const created = await app.inject({
    method: 'POST',
    url: '/customers',
    headers: { 'x-idempotency-key': 'idem-get-customer' },
    payload: {
      firstName: 'Test',
      lastName: 'User',
      email: 'test.user@example.com'
    }
  });
  const createdPayload = created.json();

  const response = await app.inject({
    method: 'GET',
    url: `/customers/${createdPayload.data.customerId}`,
    headers: opsHeaders
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.customerId, createdPayload.data.customerId);

  await app.close();
});

test('GET /customers/:customerId/profile returns profile when exists', async () => {
  const { mockDb, mockRedis } = buildHarness();
  const app = createApp({ db: mockDb, redis: mockRedis });

  const created = await app.inject({
    method: 'POST',
    url: '/customers',
    headers: { 'x-idempotency-key': 'idem-profile-1' },
    payload: {
      firstName: 'Nita',
      lastName: 'Ops',
      email: 'nita.ops@example.com'
    }
  });
  const customerId = created.json().data.customerId as string;

  await app.inject({
    method: 'PATCH',
    url: `/customers/${customerId}/profile`,
    payload: {
      displayName: 'Nita Ops',
      verificationStatus: 'APPROVED'
    }
  });

  const response = await app.inject({
    method: 'GET',
    url: `/customers/${customerId}/profile`,
    headers: opsHeaders
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.customerId, customerId);
  assert.equal(payload.data.displayName, 'Nita Ops');
  assert.equal(payload.data.verificationStatus, 'APPROVED');

  await app.close();
});

test('PATCH /customers/:customerId/profile updates allowed fields', async () => {
  const { mockDb, mockRedis } = buildHarness();
  const app = createApp({ db: mockDb, redis: mockRedis });

  const created = await app.inject({
    method: 'POST',
    url: '/customers',
    headers: { 'x-idempotency-key': 'idem-profile-2' },
    payload: {
      firstName: 'Mina',
      lastName: 'Safe',
      email: 'mina.safe@example.com'
    }
  });
  const customerId = created.json().data.customerId as string;

  const response = await app.inject({
    method: 'PATCH',
    url: `/customers/${customerId}/profile`,
    payload: {
      displayName: 'Mina S',
      countryCode: 'KH',
      contactStatus: 'CONFIRMED'
    }
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.displayName, 'Mina S');
  assert.equal(payload.data.countryCode, 'KH');
  assert.equal(payload.data.contactStatus, 'CONFIRMED');

  await app.close();
});

test('PATCH /customers/:customerId/profile rejects forbidden/invalid fields', async () => {
  const { mockDb, mockRedis } = buildHarness();
  const app = createApp({ db: mockDb, redis: mockRedis });

  const created = await app.inject({
    method: 'POST',
    url: '/customers',
    headers: { 'x-idempotency-key': 'idem-profile-3' },
    payload: {
      firstName: 'Lina',
      lastName: 'Guard',
      email: 'lina.guard@example.com'
    }
  });
  const customerId = created.json().data.customerId as string;

  const response = await app.inject({
    method: 'PATCH',
    url: `/customers/${customerId}/profile`,
    payload: {
      countryCode: 'KHM',
      riskLevel: 'SEVERE'
    }
  });

  assert.equal(response.statusCode, 400);
  const payload = response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, 'validation_failed');

  await app.close();
});

test('POST /customers emits customer.created.v1 event', async () => {
  const { mockDb, mockRedis } = buildHarness();
  const kafkaProducer = new KafkaProducerAdapter();
  const app = createApp({ db: mockDb, redis: mockRedis, kafkaProducer });

  const response = await app.inject({
    method: 'POST',
    url: '/customers',
    headers: {
      'x-idempotency-key': `idem-event-${randomUUID()}`
    },
    payload: {
      firstName: 'Ava',
      lastName: 'Chen',
      email: 'ava.chen@example.com'
    }
  });

  assert.equal(response.statusCode, 201);
  assert.ok(kafkaProducer.events.some((event) => event.type === 'customer.created.v1'));

  await app.close();
});

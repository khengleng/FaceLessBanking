import { randomUUID } from 'node:crypto';

import type { PostgresCustomerAdapter } from '../adapters/postgres-customer.adapter.js';
import type { RedisIdempotencyAdapter } from '../adapters/redis-idempotency.adapter.js';
import { buildCustomer, type Customer } from '../domain/customer.js';
import type { AuditEventsService } from '../events/audit.events.js';
import type { CustomerEventsPublisher } from '../events/customer.events.js';
import type { CreateCustomerRequestDto, ListCustomersQueryDto } from '../controllers/dtos/customer.dto.js';
import type { CustomerOpsQueryMetrics } from '../events/metrics.js';

export type CreateCustomerResult =
  | { kind: 'created'; customer: Customer }
  | { kind: 'invalid_payload'; errors: string[] }
  | { kind: 'duplicate_idempotency'; customerId: string };

export type GetCustomerResult =
  | { kind: 'found'; customer: Customer }
  | { kind: 'not_found' };

export type ListCustomersResult =
  | { kind: 'listed'; customers: Customer[] }
  | { kind: 'invalid_query'; errors: string[] };

export class CustomerApplication {
  constructor(
    private readonly postgresAdapter: PostgresCustomerAdapter,
    private readonly redisAdapter: RedisIdempotencyAdapter,
    private readonly auditEvents: AuditEventsService,
    private readonly customerEvents: CustomerEventsPublisher,
    private readonly metrics: CustomerOpsQueryMetrics
  ) {}

  async createCustomer(
    payload: CreateCustomerRequestDto,
    idempotencyKey: string
  ): Promise<CreateCustomerResult> {
    const errors = validateCreateCustomerPayload(payload);
    if (errors.length > 0) {
      return { kind: 'invalid_payload', errors };
    }

    const existingCustomerId = await this.redisAdapter.getCustomerIdByKey(idempotencyKey);
    if (existingCustomerId) {
      return { kind: 'duplicate_idempotency', customerId: existingCustomerId };
    }

    const customer = buildCustomer({
      customerId: randomUUID(),
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phoneNumber: payload.phoneNumber,
      dateOfBirth: payload.dateOfBirth,
      createdAt: new Date().toISOString()
    });

    // We should use a transaction here in a real scenario
    await this.postgresAdapter.insertCustomer(customer);
    await this.redisAdapter.saveKey(idempotencyKey, customer.customerId);
    
    // Audit records and business events
    await this.auditEvents.createCustomerAuditRecord(customer.customerId, idempotencyKey);
    await this.customerEvents.emitCustomerCreated(customer);

    return { kind: 'created', customer };
  }

  async getCustomerById(customerId: string): Promise<GetCustomerResult> {
    const customer = await this.postgresAdapter.findCustomerById(customerId);
    this.metrics.recordDetailQuery();

    if (!customer) {
      return { kind: 'not_found' };
    }

    return { kind: 'found', customer };
  }

  async listCustomers(query: ListCustomersQueryDto): Promise<ListCustomersResult> {
    const errors = validateListCustomersQuery(query);
    if (errors.length > 0) {
      return { kind: 'invalid_query', errors };
    }

    const customers = await this.postgresAdapter.listCustomers({
      customerId: query.customerId,
      onboardingReference: query.onboardingReference,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0
    });
    this.metrics.recordListQuery();
    if (query.customerId || query.onboardingReference) {
      this.metrics.recordFilteredQueryUsage();
    }

    return { kind: 'listed', customers };
  }
}

function validateCreateCustomerPayload(payload: CreateCustomerRequestDto): string[] {
  const errors: string[] = [];

  if (!payload.firstName || payload.firstName.trim().length < 2) {
    errors.push('firstName must contain at least 2 characters');
  }

  if (!payload.lastName || payload.lastName.trim().length < 2) {
    errors.push('lastName must contain at least 2 characters');
  }

  if (!payload.email || !payload.email.includes('@')) {
    errors.push('email must be a valid email address');
  }

  return errors;
}

function validateListCustomersQuery(query: ListCustomersQueryDto): string[] {
  const errors: string[] = [];

  if (query.customerId !== undefined && query.customerId.trim().length < 2) {
    errors.push('customerId must contain at least 2 characters when provided');
  }

  if (query.onboardingReference !== undefined && query.onboardingReference.trim().length < 2) {
    errors.push('onboardingReference must contain at least 2 characters when provided');
  }

  if (query.limit !== undefined && (Number.isNaN(query.limit) || query.limit < 1 || query.limit > 200)) {
    errors.push('limit must be between 1 and 200');
  }

  if (query.offset !== undefined && (Number.isNaN(query.offset) || query.offset < 0)) {
    errors.push('offset must be 0 or greater');
  }

  return errors;
}

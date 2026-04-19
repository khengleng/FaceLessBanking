import type { Customer } from '../domain/customer.js';
import type { CustomerProfile } from '../domain/customer-profile.js';

export type PostgresQueryResultRow = Record<string, unknown>;

export interface PostgresClient {
  query(
    text: string,
    params?: unknown[]
  ): Promise<{ rowCount: number | null; rows: PostgresQueryResultRow[] }>;
}

export class PostgresCustomerAdapter {
  constructor(private readonly db: PostgresClient) {}

  async insertCustomer(customer: Customer): Promise<void> {
    const query = `
      INSERT INTO customers (
        customer_id, first_name, last_name, email, phone_number, date_of_birth,
        onboarding_reference, source_entity_id, provider_reference, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `;

    await this.db.query(query, [
      customer.customerId,
      customer.firstName,
      customer.lastName,
      customer.email,
      customer.phoneNumber,
      customer.dateOfBirth,
      customer.onboardingReference,
      customer.sourceEntityId,
      customer.providerReference,
      customer.status,
      customer.createdAt,
      customer.updatedAt ?? customer.createdAt
    ]);
  }

  async createCustomer(customer: Customer): Promise<void> {
    await this.insertCustomer(customer);
  }

  async findCustomerById(customerId: string): Promise<Customer | null> {
    const query = 'SELECT * FROM customers WHERE customer_id = $1';
    const result = await this.db.query(query, [customerId]);

    if (result.rowCount === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      customerId: String(row.customer_id),
      firstName: String(row.first_name),
      lastName: String(row.last_name),
      email: String(row.email),
      phoneNumber: typeof row.phone_number === 'string' ? row.phone_number : undefined,
      dateOfBirth: typeof row.date_of_birth === 'string' ? row.date_of_birth : undefined,
      onboardingReference: typeof row.onboarding_reference === 'string' ? row.onboarding_reference : undefined,
      sourceEntityId: typeof row.source_entity_id === 'string' ? row.source_entity_id : undefined,
      providerReference: typeof row.provider_reference === 'string' ? row.provider_reference : undefined,
      status: typeof row.status === 'string' ? (row.status as Customer['status']) : 'pending_kyc',
      createdAt: String(row.created_at),
      updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined
    };
  }

  async findCustomerByOnboardingReference(onboardingReference: string): Promise<Customer | null> {
    const query = 'SELECT * FROM customers WHERE onboarding_reference = $1 LIMIT 1';
    const result = await this.db.query(query, [onboardingReference]);

    if (result.rowCount === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      customerId: String(row.customer_id),
      firstName: String(row.first_name),
      lastName: String(row.last_name),
      email: String(row.email),
      phoneNumber: typeof row.phone_number === 'string' ? row.phone_number : undefined,
      dateOfBirth: typeof row.date_of_birth === 'string' ? row.date_of_birth : undefined,
      onboardingReference: typeof row.onboarding_reference === 'string' ? row.onboarding_reference : undefined,
      sourceEntityId: typeof row.source_entity_id === 'string' ? row.source_entity_id : undefined,
      providerReference: typeof row.provider_reference === 'string' ? row.provider_reference : undefined,
      status: typeof row.status === 'string' ? (row.status as Customer['status']) : 'pending_kyc',
      createdAt: String(row.created_at),
      updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined
    };
  }

  async listCustomers(input: {
    customerId?: string;
    onboardingReference?: string;
    limit: number;
    offset: number;
  }): Promise<Customer[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (input.customerId) {
      params.push(input.customerId);
      conditions.push(`customer_id = $${params.length}`);
    }

    if (input.onboardingReference) {
      params.push(input.onboardingReference);
      conditions.push(`onboarding_reference = $${params.length}`);
    }

    params.push(input.limit);
    const limitPlaceholder = `$${params.length}`;
    params.push(input.offset);
    const offsetPlaceholder = `$${params.length}`;

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT * FROM customers
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limitPlaceholder}
      OFFSET ${offsetPlaceholder}
    `;

    const result = await this.db.query(query, params);
    return result.rows.map((row) => ({
      customerId: String(row.customer_id),
      firstName: String(row.first_name),
      lastName: String(row.last_name),
      email: String(row.email),
      phoneNumber: typeof row.phone_number === 'string' ? row.phone_number : undefined,
      dateOfBirth: typeof row.date_of_birth === 'string' ? row.date_of_birth : undefined,
      onboardingReference: typeof row.onboarding_reference === 'string' ? row.onboarding_reference : undefined,
      sourceEntityId: typeof row.source_entity_id === 'string' ? row.source_entity_id : undefined,
      providerReference: typeof row.provider_reference === 'string' ? row.provider_reference : undefined,
      status: typeof row.status === 'string' ? (row.status as Customer['status']) : 'pending_kyc',
      createdAt: String(row.created_at),
      updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined
    }));
  }

  async hasProcessedCustomerCreationEvent(sourceEventId: string): Promise<boolean> {
    const query = 'SELECT 1 FROM processed_customer_creation_events WHERE source_event_id = $1 LIMIT 1';
    const result = await this.db.query(query, [sourceEventId]);
    return (result.rowCount ?? 0) > 0;
  }

  async markCustomerCreationEventProcessed(sourceEventId: string): Promise<void> {
    const query = `
      INSERT INTO processed_customer_creation_events (source_event_id, processed_at)
      VALUES ($1, NOW())
      ON CONFLICT (source_event_id) DO NOTHING
    `;
    await this.db.query(query, [sourceEventId]);
  }

  async getCustomerProfile(customerId: string): Promise<CustomerProfile | null> {
    const query = 'SELECT * FROM customer_profiles WHERE customer_id = $1 LIMIT 1';
    const result = await this.db.query(query, [customerId]);

    if (result.rowCount === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      customerId: String(row.customer_id),
      displayName: typeof row.display_name === 'string' ? row.display_name : undefined,
      onboardingReference: typeof row.onboarding_reference === 'string' ? row.onboarding_reference : undefined,
      verificationStatus: typeof row.verification_status === 'string' ? (row.verification_status as CustomerProfile['verificationStatus']) : 'UNVERIFIED',
      riskLevel: typeof row.risk_level === 'string' ? (row.risk_level as CustomerProfile['riskLevel']) : 'UNKNOWN',
      countryCode: typeof row.country_code === 'string' ? row.country_code : undefined,
      contactStatus: typeof row.contact_status === 'string' ? (row.contact_status as CustomerProfile['contactStatus']) : 'UNKNOWN',
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at)
    };
  }

  async upsertCustomerProfile(profile: CustomerProfile): Promise<void> {
    const query = `
      INSERT INTO customer_profiles (
        customer_id, display_name, onboarding_reference, verification_status, risk_level,
        country_code, contact_status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (customer_id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        onboarding_reference = EXCLUDED.onboarding_reference,
        verification_status = EXCLUDED.verification_status,
        risk_level = EXCLUDED.risk_level,
        country_code = EXCLUDED.country_code,
        contact_status = EXCLUDED.contact_status,
        updated_at = EXCLUDED.updated_at
    `;

    await this.db.query(query, [
      profile.customerId,
      profile.displayName,
      profile.onboardingReference,
      profile.verificationStatus,
      profile.riskLevel,
      profile.countryCode,
      profile.contactStatus,
      profile.createdAt,
      profile.updatedAt
    ]);
  }

  async hasProcessedProfileEvent(sourceEventId: string): Promise<boolean> {
    const query = 'SELECT 1 FROM processed_customer_profile_events WHERE source_event_id = $1 LIMIT 1';
    const result = await this.db.query(query, [sourceEventId]);
    return (result.rowCount ?? 0) > 0;
  }

  async markProfileEventProcessed(sourceEventId: string): Promise<void> {
    const query = `
      INSERT INTO processed_customer_profile_events (source_event_id, processed_at)
      VALUES ($1, NOW())
      ON CONFLICT (source_event_id) DO NOTHING
    `;
    await this.db.query(query, [sourceEventId]);
  }
}

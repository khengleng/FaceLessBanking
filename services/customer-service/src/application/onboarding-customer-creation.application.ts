import { randomUUID } from 'node:crypto';

import type { PostgresCustomerAdapter } from '../adapters/postgres-customer.adapter.js';
import { buildCustomer, type Customer } from '../domain/customer.js';
import type { AuditEventsService } from '../events/audit.events.js';
import type { CustomerEventsPublisher } from '../events/customer.events.js';
import type { OnboardingCustomerCreationMetrics } from '../events/metrics.js';

type EkycApprovedEvent = {
  specVersion: '1.0';
  type: 'ekyc.status.updated.v1';
  version: number;
  metadata: {
    eventId: string;
    correlationId: string;
    timestamp: string;
    producer: string;
    causationId?: string;
  };
  payload: {
    sessionId: string;
    customerId?: string;
    status: string;
    newStatus?: string;
    provider?: string;
  };
};

type CaseApprovedEvent = {
  specVersion: '1.0';
  type: 'case.action.recorded.v1';
  version: number;
  metadata: {
    eventId: string;
    correlationId: string;
    timestamp: string;
    producer: string;
    causationId?: string;
  };
  payload: {
    caseId: string;
    actionId: string;
    newStatus?: string;
    caseType?: string;
    entityId?: string;
  };
};

export type ProcessOnboardingApprovalResult =
  | { kind: 'created'; customer: Customer }
  | { kind: 'ignored_status' }
  | { kind: 'ignored_not_onboarding_case' }
  | { kind: 'duplicate_event' }
  | { kind: 'already_exists'; customerId: string }
  | { kind: 'invalid_event'; reason: string };

export class OnboardingCustomerCreationApplication {
  constructor(
    private readonly postgresAdapter: PostgresCustomerAdapter,
    private readonly customerEvents: CustomerEventsPublisher,
    private readonly auditEvents: AuditEventsService,
    private readonly metrics: OnboardingCustomerCreationMetrics,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  async processEkycStatusUpdated(rawEvent: unknown): Promise<ProcessOnboardingApprovalResult> {
    const event = parseEkycApprovedEvent(rawEvent);
    if (!event) {
      return { kind: 'invalid_event', reason: 'invalid_ekyc_event_envelope' };
    }

    const status = event.payload.newStatus ?? event.payload.status;
    if (status !== 'APPROVED') {
      return { kind: 'ignored_status' };
    }

    return this.createCustomerFromApproval({
      sourceEventId: event.metadata.eventId,
      correlationId: event.metadata.correlationId,
      onboardingReference: event.payload.customerId ?? event.payload.sessionId,
      sourceEntityId: event.payload.sessionId,
      providerReference: event.payload.provider,
      source: 'ekyc.status.updated.v1'
    });
  }

  async processCaseActionRecorded(rawEvent: unknown): Promise<ProcessOnboardingApprovalResult> {
    const event = parseCaseApprovedEvent(rawEvent);
    if (!event) {
      return { kind: 'invalid_event', reason: 'invalid_case_event_envelope' };
    }

    if (event.payload.newStatus !== 'APPROVED') {
      return { kind: 'ignored_status' };
    }

    if (
      event.payload.caseType
      && event.payload.caseType !== 'onboarding-review'
      && event.payload.caseType !== 'ONBOARDING_REVIEW'
    ) {
      return { kind: 'ignored_not_onboarding_case' };
    }

    return this.createCustomerFromApproval({
      sourceEventId: event.metadata.eventId,
      correlationId: event.metadata.correlationId,
      onboardingReference: event.payload.entityId ?? event.payload.caseId,
      sourceEntityId: event.payload.caseId,
      source: 'case.action.recorded.v1'
    });
  }

  private async createCustomerFromApproval(input: {
    sourceEventId: string;
    correlationId: string;
    onboardingReference: string;
    sourceEntityId: string;
    providerReference?: string;
    source: 'ekyc.status.updated.v1' | 'case.action.recorded.v1';
  }): Promise<ProcessOnboardingApprovalResult> {
    const alreadyProcessed = await this.postgresAdapter.hasProcessedCustomerCreationEvent(input.sourceEventId);
    if (alreadyProcessed) {
      this.metrics.recordDuplicateCustomerCreationEventSkipped();
      return { kind: 'duplicate_event' };
    }

    const existingCustomer = await this.postgresAdapter.findCustomerByOnboardingReference(
      input.onboardingReference
    );
    if (existingCustomer) {
      await this.postgresAdapter.markCustomerCreationEventProcessed(input.sourceEventId);
      this.metrics.recordApprovalIgnoredCustomerAlreadyExists();
      this.logger.info(
        {
          sourceEventId: input.sourceEventId,
          correlationId: input.correlationId,
          onboardingReference: input.onboardingReference,
          customerId: existingCustomer.customerId
        },
        'Skipping onboarding approval because customer already exists'
      );
      return { kind: 'already_exists', customerId: existingCustomer.customerId };
    }

    const now = new Date().toISOString();
    const safeRef = sanitizeRef(input.onboardingReference);
    const customer = buildCustomer({
      customerId: randomUUID(),
      firstName: 'Onboarding',
      lastName: 'Customer',
      email: `onboarding+${safeRef}@placeholder.local`,
      onboardingReference: input.onboardingReference,
      sourceEntityId: input.sourceEntityId,
      providerReference: input.providerReference,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now
    });

    await this.postgresAdapter.createCustomer(customer);
    await this.postgresAdapter.markCustomerCreationEventProcessed(input.sourceEventId);
    await this.auditEvents.createCustomerOnboardingAuditRecord({
      customerId: customer.customerId,
      onboardingReference: input.onboardingReference,
      sourceEventId: input.sourceEventId,
      correlationId: input.correlationId
    });
    await this.customerEvents.emitCustomerCreatedFromOnboarding({
      customer,
      correlationId: input.correlationId,
      sourceEventId: input.sourceEventId
    });

    this.metrics.recordCustomerCreatedFromOnboarding();
    this.logger.info(
      {
        sourceEventId: input.sourceEventId,
        correlationId: input.correlationId,
        onboardingReference: input.onboardingReference,
        customerId: customer.customerId,
        source: input.source
      },
      'Created customer from onboarding approval event'
    );

    return { kind: 'created', customer };
  }
}

function sanitizeRef(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'unknown';
}

function parseEkycApprovedEvent(rawEvent: unknown): EkycApprovedEvent | null {
  if (!rawEvent || typeof rawEvent !== 'object') {
    return null;
  }

  const event = rawEvent as Record<string, unknown>;
  if (event.specVersion !== '1.0' || event.type !== 'ekyc.status.updated.v1' || typeof event.version !== 'number') {
    return null;
  }

  const metadata = event.metadata as Record<string, unknown> | undefined;
  const payload = event.payload as Record<string, unknown> | undefined;
  if (!metadata || !payload) {
    return null;
  }

  if (
    typeof metadata.eventId !== 'string'
    || typeof metadata.correlationId !== 'string'
    || typeof metadata.timestamp !== 'string'
    || typeof metadata.producer !== 'string'
  ) {
    return null;
  }

  if (
    typeof payload.sessionId !== 'string'
    || typeof payload.status !== 'string'
  ) {
    return null;
  }

  if (payload.newStatus !== undefined && typeof payload.newStatus !== 'string') {
    return null;
  }

  if (payload.customerId !== undefined && typeof payload.customerId !== 'string') {
    return null;
  }

  if (payload.provider !== undefined && typeof payload.provider !== 'string') {
    return null;
  }

  return event as EkycApprovedEvent;
}

function parseCaseApprovedEvent(rawEvent: unknown): CaseApprovedEvent | null {
  if (!rawEvent || typeof rawEvent !== 'object') {
    return null;
  }

  const event = rawEvent as Record<string, unknown>;
  if (event.specVersion !== '1.0' || event.type !== 'case.action.recorded.v1' || typeof event.version !== 'number') {
    return null;
  }

  const metadata = event.metadata as Record<string, unknown> | undefined;
  const payload = event.payload as Record<string, unknown> | undefined;
  if (!metadata || !payload) {
    return null;
  }

  if (
    typeof metadata.eventId !== 'string'
    || typeof metadata.correlationId !== 'string'
    || typeof metadata.timestamp !== 'string'
    || typeof metadata.producer !== 'string'
  ) {
    return null;
  }

  if (
    typeof payload.caseId !== 'string'
    || typeof payload.actionId !== 'string'
  ) {
    return null;
  }

  if (payload.newStatus !== undefined && typeof payload.newStatus !== 'string') {
    return null;
  }

  if (payload.caseType !== undefined && typeof payload.caseType !== 'string') {
    return null;
  }

  if (payload.entityId !== undefined && typeof payload.entityId !== 'string') {
    return null;
  }

  return event as CaseApprovedEvent;
}

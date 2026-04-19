import type { EventEnvelope } from '@faceless-banking/shared-events';

import type { InvestigationEntityType, InvestigationIndexRecord } from './investigation-index-record.js';

export const SUPPORTED_INDEX_EVENT_TYPES = [
  'customer.created.v1',
  'customer.profile.enriched.v1',
  'account.created.v1',
  'account.activated.v1',
  'payment.initiated.v1',
  'payment.status.updated.v1',
  'case.created.v1',
  'case.action.recorded.v1'
] as const;

export type SupportedIndexEventType = (typeof SUPPORTED_INDEX_EVENT_TYPES)[number];

export type ParsedLifecycleEvent = EventEnvelope<SupportedIndexEventType, Record<string, unknown>>;

export function parseLifecycleEvent(rawEvent: unknown): ParsedLifecycleEvent | null {
  if (!rawEvent || typeof rawEvent !== 'object') {
    return null;
  }

  const event = rawEvent as Record<string, unknown>;
  if (event.specVersion !== '1.0') {
    return null;
  }

  if (typeof event.type !== 'string' || !isSupportedType(event.type)) {
    return null;
  }

  if (typeof event.version !== 'number') {
    return null;
  }

  const metadata = event.metadata as Record<string, unknown> | undefined;
  const payloadRaw = event.payload;

  if (!metadata || !payloadRaw || typeof payloadRaw !== 'object' || Array.isArray(payloadRaw)) {
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

  return event as ParsedLifecycleEvent;
}

export function mapLifecycleEventToIndexRecord(
  event: ParsedLifecycleEvent,
  existing: InvestigationIndexRecord | null,
  nowIso: string
): InvestigationIndexRecord | null {
  const mapped = mapEntity(event.type, event.payload);
  if (!mapped) {
    return null;
  }

  const correlationId = event.metadata.correlationId;
  const sourceEventId = event.metadata.eventId;
  const createdAt = existing?.createdAt ?? nowIso;
  const updatedAt = event.metadata.timestamp || nowIso;

  const searchableText = buildSearchableText({
    entityType: mapped.entityType,
    entityId: mapped.entityId,
    correlationId,
    customerId: mapped.customerId,
    accountId: mapped.accountId,
    paymentId: mapped.paymentId,
    caseId: mapped.caseId,
    status: mapped.status
  });

  return {
    indexId: existing?.indexId ?? `${mapped.entityType}:${mapped.entityId}`,
    entityType: mapped.entityType,
    entityId: mapped.entityId,
    correlationId,
    customerId: mapped.customerId,
    accountId: mapped.accountId,
    paymentId: mapped.paymentId,
    caseId: mapped.caseId,
    status: mapped.status,
    searchableText,
    sourceEventId,
    createdAt,
    updatedAt
  };
}

function isSupportedType(type: string): type is SupportedIndexEventType {
  return (SUPPORTED_INDEX_EVENT_TYPES as readonly string[]).includes(type);
}

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function mapEntity(type: SupportedIndexEventType, payload: Record<string, unknown>): {
  entityType: InvestigationEntityType;
  entityId: string;
  customerId?: string;
  accountId?: string;
  paymentId?: string;
  caseId?: string;
  status?: string;
} | null {
  switch (type) {
    case 'customer.created.v1':
    case 'customer.profile.enriched.v1': {
      const customerId = asString(payload.customerId);
      if (!customerId) {
        return null;
      }

      return {
        entityType: 'CUSTOMER',
        entityId: customerId,
        customerId,
        status: asString(payload.status) ?? asString(payload.verificationStatus)
      };
    }
    case 'account.created.v1':
    case 'account.activated.v1': {
      const accountId = asString(payload.accountId);
      if (!accountId) {
        return null;
      }

      return {
        entityType: 'ACCOUNT',
        entityId: accountId,
        accountId,
        customerId: asString(payload.customerId),
        status: asString(payload.newStatus) ?? asString(payload.status)
      };
    }
    case 'payment.initiated.v1': {
      const paymentId = asString(payload.paymentId);
      if (!paymentId) {
        return null;
      }

      return {
        entityType: 'PAYMENT',
        entityId: paymentId,
        paymentId,
        accountId: asString(payload.sourceAccountId),
        status: asString(payload.status) ?? 'INITIATED'
      };
    }
    case 'payment.status.updated.v1': {
      const paymentId = asString(payload.paymentId);
      if (!paymentId) {
        return null;
      }

      return {
        entityType: 'PAYMENT',
        entityId: paymentId,
        paymentId,
        accountId: asString(payload.sourceAccountId),
        status: asString(payload.status)
      };
    }
    case 'case.created.v1':
    case 'case.action.recorded.v1': {
      const caseId = asString(payload.caseId);
      if (!caseId) {
        return null;
      }

      return {
        entityType: 'ONBOARDING_CASE',
        entityId: caseId,
        caseId,
        customerId: asString(payload.customerId),
        status: asString(payload.newStatus) ?? asString(payload.status)
      };
    }
    default:
      return null;
  }
}

function buildSearchableText(input: {
  entityType: string;
  entityId: string;
  correlationId?: string;
  customerId?: string;
  accountId?: string;
  paymentId?: string;
  caseId?: string;
  status?: string;
}): string {
  const tokens = [
    input.entityType,
    input.entityId,
    input.correlationId,
    input.customerId,
    input.accountId,
    input.paymentId,
    input.caseId,
    input.status
  ]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .map((value) => value.toLowerCase());

  return tokens.join(' ');
}

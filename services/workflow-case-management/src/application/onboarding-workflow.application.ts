import { randomUUID } from 'node:crypto';

import type { PostgresCaseAdapter } from '../adapters/postgres-case.adapter.js';
import { buildCaseAction, type CaseAction } from '../domain/case-action.js';
import type { CaseRecord } from '../domain/case.js';
import { buildCase } from '../domain/case.js';
import {
  deriveActionType,
  isValidOnboardingTransition,
  mapEkycToOnboardingStatus,
  type OnboardingWorkflowStatus
} from '../domain/onboarding-workflow.js';
import type { CaseEventsPublisher } from '../events/case.events.js';
import type { OnboardingWorkflowMetrics } from '../events/metrics.js';

export type EkycStatusUpdatedEvent = {
  specVersion: '1.0';
  type: 'ekyc.status.updated.v1';
  version: number;
  metadata: {
    eventId: string;
    correlationId: string;
    causationId?: string;
    timestamp: string;
    producer: string;
  };
  payload: {
    sessionId: string;
    customerId?: string;
    status: string;
    newStatus?: string;
    oldStatus?: string;
    reviewResult?: string;
  };
};

export type ProcessOnboardingWorkflowResult =
  | { kind: 'created'; caseRecord: CaseRecord; action?: CaseAction }
  | { kind: 'transitioned'; caseRecord: CaseRecord; action: CaseAction }
  | { kind: 'duplicate' }
  | { kind: 'ignored'; reason: string }
  | { kind: 'invalid_transition'; reason: string }
  | { kind: 'invalid_event'; reason: string };

export class OnboardingWorkflowApplication {
  constructor(
    private readonly postgresAdapter: PostgresCaseAdapter,
    private readonly eventsPublisher: CaseEventsPublisher,
    private readonly metrics: OnboardingWorkflowMetrics,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  async processEkycStatusUpdated(rawEvent: unknown): Promise<ProcessOnboardingWorkflowResult> {
    const event = parseEkycStatusUpdated(rawEvent);
    if (!event) {
      return { kind: 'invalid_event', reason: 'invalid_event_envelope' };
    }

    const sourceEventId = event.metadata.eventId;
    const correlationId = event.metadata.correlationId;

    const alreadyProcessed = await this.postgresAdapter.hasProcessedWorkflowEvent(sourceEventId);
    if (alreadyProcessed) {
      this.metrics.recordDuplicateWorkflowEventSkipped();
      return { kind: 'duplicate' };
    }

    const mappedStatus = mapEkycToOnboardingStatus(event.payload.newStatus ?? event.payload.status);
    if (!mappedStatus) {
      await this.postgresAdapter.markWorkflowEventProcessed(sourceEventId);
      return { kind: 'ignored', reason: 'unmapped_ekyc_status' };
    }

    const entityType = event.payload.customerId ? 'CUSTOMER_ONBOARDING' : 'EKYC_SESSION';
    const entityId = event.payload.customerId ?? event.payload.sessionId;

    let caseRecord = await this.postgresAdapter.getCaseByEntity(entityType, entityId);
    let created = false;

    if (!caseRecord) {
      const now = new Date().toISOString();
      caseRecord = {
        ...buildCase({
          caseId: randomUUID(),
          caseType: 'onboarding-review',
          referenceId: entityId,
          createdAt: now
        }),
        entityType,
        entityId,
        status: 'NEW'
      };

      await this.postgresAdapter.createCase(caseRecord);
      await this.eventsPublisher.emitCaseCreated(caseRecord);
      this.metrics.recordOnboardingCaseCreated();
      created = true;
    }

    const currentStatus = caseRecord.status as OnboardingWorkflowStatus;

    if (currentStatus === mappedStatus) {
      await this.postgresAdapter.markWorkflowEventProcessed(sourceEventId);
      return { kind: 'ignored', reason: 'status_unchanged' };
    }

    if (!isValidOnboardingTransition(currentStatus, mappedStatus)) {
      this.metrics.recordInvalidTransitionBlocked();
      await this.postgresAdapter.markWorkflowEventProcessed(sourceEventId);
      this.logger.warn(
        {
          caseId: caseRecord.caseId,
          sourceEventId,
          correlationId,
          currentStatus,
          nextStatus: mappedStatus
        },
        'Blocked invalid onboarding transition from ekyc event'
      );
      return { kind: 'invalid_transition', reason: `${currentStatus}->${mappedStatus}` };
    }

    const now = new Date().toISOString();
    const action = buildCaseAction({
      actionId: randomUUID(),
      caseId: caseRecord.caseId,
      actionType: deriveActionType(mappedStatus),
      actorId: 'system:ekyc-orchestration',
      oldStatus: currentStatus,
      newStatus: mappedStatus,
      reason: event.payload.reviewResult,
      sourceEventId,
      createdAt: now
    });

    await this.postgresAdapter.createCaseAction(action);
    await this.postgresAdapter.updateCaseStatus(caseRecord.caseId, mappedStatus);
    await this.eventsPublisher.emitCaseActionRecorded(action);
    this.metrics.recordOnboardingCaseTransitioned();

    await this.postgresAdapter.markWorkflowEventProcessed(sourceEventId);

    const latest = (await this.postgresAdapter.findCaseById(caseRecord.caseId)) ?? {
      ...caseRecord,
      status: mappedStatus,
      updatedAt: now
    };

    this.logger.info(
      {
        caseId: caseRecord.caseId,
        sourceEventId,
        correlationId,
        oldStatus: currentStatus,
        newStatus: mappedStatus,
        created
      },
      'Applied onboarding workflow transition from ekyc.status.updated.v1'
    );

    if (created) {
      return {
        kind: 'created',
        caseRecord: latest,
        action
      };
    }

    return {
      kind: 'transitioned',
      caseRecord: latest,
      action
    };
  }
}

function parseEkycStatusUpdated(rawEvent: unknown): EkycStatusUpdatedEvent | null {
  if (!rawEvent || typeof rawEvent !== 'object') {
    return null;
  }

  const event = rawEvent as Record<string, unknown>;

  if (event.specVersion !== '1.0' || event.type !== 'ekyc.status.updated.v1') {
    return null;
  }

  if (typeof event.version !== 'number') {
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

  if (typeof payload.sessionId !== 'string') {
    return null;
  }

  if (typeof payload.status !== 'string' && typeof payload.newStatus !== 'string') {
    return null;
  }

  if (payload.customerId !== undefined && typeof payload.customerId !== 'string') {
    return null;
  }

  if (payload.newStatus !== undefined && typeof payload.newStatus !== 'string') {
    return null;
  }

  if (payload.oldStatus !== undefined && typeof payload.oldStatus !== 'string') {
    return null;
  }

  if (payload.reviewResult !== undefined && typeof payload.reviewResult !== 'string') {
    return null;
  }

  return event as EkycStatusUpdatedEvent;
}

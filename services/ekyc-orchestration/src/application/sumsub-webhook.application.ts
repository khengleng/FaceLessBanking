import { createHash, randomUUID } from 'node:crypto';

import type { PostgresEkycAdapter } from '../adapters/postgres-ekyc.adapter.js';
import type { SumsubWebhookVerifierAdapter } from '../adapters/sumsub-webhook-verifier.adapter.js';
import type { SumsubWebhookRequestDto } from '../controllers/dtos/sumsub-webhook.dto.js';
import { mapSumsubReviewToInternalStatus } from '../domain/sumsub-status-mapper.js';
import type { WebhookReceipt } from '../domain/webhook-receipt.js';
import type { EkycEventsPublisher } from '../events/ekyc.events.js';
import type { EkycWebhookMetrics } from '../events/metrics.js';

export type ProcessSumsubWebhookResult =
  | { kind: 'processed'; sessionId: string; newStatus: string }
  | { kind: 'duplicate'; dedupeKey: string }
  | { kind: 'invalid_signature'; reason: string }
  | { kind: 'invalid_payload'; errors: string[] }
  | { kind: 'session_not_found' };

export class SumsubWebhookApplication {
  constructor(
    private readonly postgresAdapter: PostgresEkycAdapter,
    private readonly verifier: SumsubWebhookVerifierAdapter,
    private readonly eventsPublisher: EkycEventsPublisher,
    private readonly metrics: EkycWebhookMetrics,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  async processWebhook(input: SumsubWebhookRequestDto): Promise<ProcessSumsubWebhookResult> {
    this.metrics.recordWebhookReceived();

    const verification = this.verifier.verifySignature(input.headers, input.rawBody);
    if (!verification.valid) {
      this.logger.warn({ reason: verification.reason }, 'Sumsub webhook signature verification failed');
      return { kind: 'invalid_signature', reason: verification.reason };
    }

    const errors = validatePayload(input.payload);
    if (errors.length > 0) {
      return { kind: 'invalid_payload', errors };
    }

    this.metrics.recordWebhookValidated();

    const dedupeKey = buildDedupeKey(input.payload);
    const alreadyProcessed = await this.postgresAdapter.hasProcessedWebhookReceipt(dedupeKey);
    if (alreadyProcessed) {
      this.metrics.recordDuplicateWebhookSkipped();
      return { kind: 'duplicate', dedupeKey };
    }

    const receivedAt = new Date().toISOString();
    const correlationId = getCorrelationId(input.headers) ?? input.payload.inspectionId;
    const receipt: WebhookReceipt = {
      receiptId: randomUUID(),
      source: 'SUMSUB',
      dedupeKey,
      externalEventId: input.payload.inspectionId,
      eventType: input.payload.type,
      receivedAt,
      processedAt: undefined,
      correlationId
    };
    await this.postgresAdapter.createWebhookReceipt(receipt);

    const session = await this.postgresAdapter.getEkycSessionBySumsubApplicantId(input.payload.applicantId!);
    if (!session) {
      return { kind: 'session_not_found' };
    }

    const mapped = mapSumsubReviewToInternalStatus({
      reviewStatus: input.payload.reviewStatus,
      reviewResultAnswer: input.payload.reviewResult?.reviewAnswer,
      reviewRejectType: input.payload.reviewResult?.reviewRejectType
    });

    const updatedAt = new Date().toISOString();
    const oldStatus = session.status;

    const updated = await this.postgresAdapter.updateEkycSessionStatus({
      sessionId: session.sessionId,
      newStatus: mapped.newStatus,
      reviewResult: mapped.reviewResult,
      verificationLevel: input.payload.type,
      updatedAt
    });

    if (!updated) {
      return { kind: 'session_not_found' };
    }

    await this.eventsPublisher.emitStatusUpdatedFromWebhook({
      session: updated,
      oldStatus,
      newStatus: mapped.newStatus,
      correlationId,
      reviewResult: mapped.reviewResult,
      timestamp: updatedAt
    });

    await this.postgresAdapter.markWebhookReceiptProcessed(dedupeKey, new Date().toISOString());
    this.metrics.recordEkycStatusUpdatedEmitted();

    this.logger.info(
      {
        sessionId: updated.sessionId,
        sumsubApplicantId: updated.sumsubApplicantId,
        oldStatus,
        newStatus: mapped.newStatus,
        dedupeKey,
        correlationId
      },
      'Processed Sumsub webhook and emitted ekyc.status.updated.v1'
    );

    return {
      kind: 'processed',
      sessionId: updated.sessionId,
      newStatus: mapped.newStatus
    };
  }
}

function validatePayload(payload: SumsubWebhookRequestDto['payload']): string[] {
  const errors: string[] = [];

  if (!payload || typeof payload !== 'object') {
    errors.push('payload must be an object');
    return errors;
  }

  if (!payload.applicantId || payload.applicantId.trim().length < 3) {
    errors.push('applicantId is required');
  }

  const hasReviewSignal = Boolean(payload.reviewStatus)
    || Boolean(payload.reviewResult?.reviewAnswer)
    || Boolean(payload.reviewResult?.reviewRejectType);

  if (!hasReviewSignal) {
    errors.push('review status or result is required');
  }

  return errors;
}

function buildDedupeKey(payload: SumsubWebhookRequestDto['payload']): string {
  const base = [
    payload.inspectionId ?? '',
    payload.applicantId ?? '',
    payload.type ?? '',
    payload.reviewStatus ?? '',
    payload.reviewResult?.reviewAnswer ?? '',
    payload.reviewResult?.reviewRejectType ?? ''
  ].join('|');

  return createHash('sha256').update(base).digest('hex');
}

function getCorrelationId(
  headers: Record<string, string | string[] | undefined>
): string | undefined {
  const header = headers['x-correlation-id'] ?? headers['X-Correlation-Id'];
  if (Array.isArray(header)) {
    return header[0];
  }

  return typeof header === 'string' ? header : undefined;
}

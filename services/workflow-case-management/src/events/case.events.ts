import type { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import type { CaseAction } from '../domain/case-action.js';
import type { CaseRecord } from '../domain/case.js';
import type { MakerCheckerDecision } from '../domain/maker-checker.js';
import type { DisputeRecord } from '../domain/dispute.js';

export class CaseEventsPublisher {
  constructor(private readonly kafkaProducer: KafkaProducerAdapter) {}

  async emitCaseCreated(record: CaseRecord): Promise<void> {
    await this.kafkaProducer.publish({
      eventName: 'case.created.v1',
      aggregateId: record.caseId,
      occurredAt: new Date().toISOString(),
      payload: {
        caseId: record.caseId,
        caseType: record.caseType,
        status: record.status,
        entityType: record.entityType,
        entityId: record.entityId
      }
    });
  }

  async emitCaseActionRecorded(action: CaseAction): Promise<void> {
    await this.kafkaProducer.publish({
      eventName: 'case.action.recorded.v1',
      aggregateId: action.caseId,
      occurredAt: new Date().toISOString(),
      payload: {
        caseId: action.caseId,
        actionId: action.actionId,
        actionType: action.actionType,
        oldStatus: action.oldStatus,
        newStatus: action.newStatus,
        reason: action.reason,
        sourceEventId: action.sourceEventId
      }
    });
  }

  async emitMakerCheckerPolicyApplied(decision: MakerCheckerDecision, correlationId?: string): Promise<void> {
    await this.kafkaProducer.publish({
      eventName: 'makerchecker.policy.applied.v1',
      aggregateId: decision.decisionId,
      occurredAt: decision.evaluatedAt,
      payload: {
        decisionId: decision.decisionId,
        actionType: decision.actionType,
        policyId: decision.policyId,
        requiresApproval: decision.requiresApproval,
        caseId: decision.caseId,
        correlationId
      }
    });
  }

  async emitDisputeCreated(dispute: DisputeRecord, correlationId?: string): Promise<void> {
    await this.kafkaProducer.publish({
      eventName: 'dispute.created.v1',
      aggregateId: dispute.disputeId,
      occurredAt: dispute.createdAt,
      payload: {
        disputeId: dispute.disputeId,
        entityType: dispute.entityType,
        entityId: dispute.entityId,
        customerId: dispute.customerId,
        amount: dispute.amount,
        currency: dispute.currency,
        status: dispute.status,
        correlationId
      }
    });
  }

  async emitDisputeUpdated(dispute: DisputeRecord, correlationId?: string): Promise<void> {
    await this.kafkaProducer.publish({
      eventName: 'dispute.updated.v1',
      aggregateId: dispute.disputeId,
      occurredAt: dispute.updatedAt,
      payload: {
        disputeId: dispute.disputeId,
        status: dispute.status,
        escalationLevel: dispute.escalationLevel,
        correlationId
      }
    });
  }
}

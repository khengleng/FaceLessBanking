import { randomUUID } from 'node:crypto';
import type { PostgresCaseAdapter } from '../adapters/postgres-case.adapter.js';
import { 
  buildDispute, 
  type DisputeRecord
} from '../domain/dispute.js';
import { buildCase, type CaseRecord, type CaseType } from '../domain/case.js';

type DisputeEventsPublisher = {
  emitCaseCreated: (record: CaseRecord) => Promise<void>;
  emitDisputeCreated: (dispute: DisputeRecord, correlationId?: string) => Promise<void>;
  emitDisputeUpdated: (dispute: DisputeRecord, correlationId?: string) => Promise<void>;
};

export class DisputeApplication {
  constructor(
    private readonly postgresAdapter: PostgresCaseAdapter,
    private readonly eventsPublisher: DisputeEventsPublisher,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  async createDispute(params: {
    entityType: 'payment' | 'account' | 'loan';
    entityId: string;
    customerId: string;
    amount: number;
    currency: string;
    reason: string;
    correlationId?: string;
  }): Promise<DisputeRecord> {
    const disputeId = randomUUID();
    const dispute = buildDispute({
      disputeId,
      ...params,
      createdAt: new Date().toISOString()
    });

    await this.postgresAdapter.createDispute(dispute);
    
    const reviewCase = buildCase({
      caseId: disputeId, // Use same ID for simplicity in linking
      caseType: 'dispute-review' as CaseType,
      referenceId: params.entityId,
      createdAt: new Date().toISOString()
    });

    await this.postgresAdapter.insertCase(reviewCase);
    await this.eventsPublisher.emitCaseCreated(reviewCase);
    await this.eventsPublisher.emitDisputeCreated(dispute, params.correlationId);

    return dispute;
  }

  async getDispute(disputeId: string): Promise<DisputeRecord | null> {
    return this.postgresAdapter.getDisputeById(disputeId);
  }

  async escalateDispute(disputeId: string, correlationId?: string): Promise<DisputeRecord> {
    const dispute = await this.postgresAdapter.getDisputeById(disputeId);
    if (!dispute) throw new Error('Dispute not found');

    if (dispute.status !== 'OPEN' && dispute.status !== 'UNDER_REVIEW') {
      throw new Error(`Cannot escalate dispute in ${dispute.status} status`);
    }

    const nextLevel = dispute.escalationLevel + 1;
    await this.postgresAdapter.updateDisputeStatus(disputeId, 'ESCALATED', nextLevel);

    const updated = await this.postgresAdapter.getDisputeById(disputeId);
    if (updated) {
      await this.eventsPublisher.emitDisputeUpdated(updated, correlationId);
      return updated;
    }
    return dispute;
  }

  async resolveDispute(disputeId: string, resolution: 'RESOLVED' | 'REJECTED', correlationId?: string): Promise<DisputeRecord> {
    const dispute = await this.postgresAdapter.getDisputeById(disputeId);
    if (!dispute) throw new Error('Dispute not found');

    if (['RESOLVED', 'REJECTED'].includes(dispute.status)) {
      throw new Error('Dispute already finalized');
    }

    await this.postgresAdapter.updateDisputeStatus(disputeId, resolution);

    const updated = await this.postgresAdapter.getDisputeById(disputeId);
    if (updated) {
      await this.eventsPublisher.emitDisputeUpdated(updated, correlationId);
      return updated;
    }
    return dispute;
  }
}

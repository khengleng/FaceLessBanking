import type { PostgresFeeAdapter } from '../adapters/postgres-fee.adapter.js';
import type { FeeEventsPublisher } from '../events/fee-publisher.adapter.js';
import type { PaymentOrchestrationAdapter } from '../adapters/payment-orchestration.adapter.js';

export class FeeCollectionApplication {
  constructor(
    private readonly postgresAdapter: PostgresFeeAdapter,
    private readonly eventPublisher: FeeEventsPublisher,
    private readonly paymentAdapter: PaymentOrchestrationAdapter,
    private readonly bankFeeIncomeAccount: string = 'GL-FEE-INCOME-TEST',
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  async collectFee(assessmentId: string, correlationId?: string): Promise<void> {
    const assessment = await this.postgresAdapter.getFeeAssessment(assessmentId);
    if (!assessment) {
      throw new Error(`Fee assessment ${assessmentId} not found`);
    }

    if (assessment.status !== 'ASSESSED') {
      this.logger.warn({ assessmentId, status: assessment.status }, 'Fee assessment already being collected or processed.');
      return;
    }

    try {
      await this.postgresAdapter.updateFeeStatus(assessmentId, 'COLLECTION_PENDING');

      // In a real scenario, the customerAccount would be looked up or passed in the assessment
      // For now, we assume assessment.customerId is the sourceAccountId
      const result = await this.paymentAdapter.initiateInternalTransfer({
        sourceAccountId: assessment.customerId,
        destinationAccountId: this.bankFeeIncomeAccount,
        amountCents: assessment.assessedAmountCents,
        currency: assessment.currency,
        idempotencyKey: assessment.assessmentId,
        metadata: {
          isFee: true,
          assessmentId: assessment.assessmentId,
          ruleId: assessment.ruleId
        }
      });

      // Update with payment ID
      await this.postgresAdapter.updateFeeStatus(assessmentId, 'COLLECTION_PENDING', result.paymentId);
      
      this.logger.info({ assessmentId, paymentId: result.paymentId }, 'Fee collection initiated successfully.');

      // In a real scenario, we'd wait for payment.completed event
      // For this implementation, we'll auto-succeed if payment initiation worked
      await this.handleCollectionSuccess(assessmentId, result.paymentId, correlationId);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown fee collection error';
      this.logger.error({ err, assessmentId }, 'Failed to initiate fee collection');
      await this.postgresAdapter.updateFeeStatus(assessmentId, 'FAILED', undefined, message);
      
      const updated = await this.postgresAdapter.getFeeAssessment(assessmentId);
      if (updated) {
        await this.eventPublisher.emitFeeFailed(updated, message, correlationId);
      }
    }
  }

  async handleCollectionSuccess(assessmentId: string, paymentId: string, correlationId?: string): Promise<void> {
    await this.postgresAdapter.updateFeeStatus(assessmentId, 'COLLECTED', paymentId);
    
    const updated = await this.postgresAdapter.getFeeAssessment(assessmentId);
    if (updated) {
      await this.eventPublisher.emitFeeCollected(updated, correlationId);
      this.logger.info({ assessmentId, paymentId }, 'Fee collected successfully.');
    }
  }

  async handleCollectionFailure(assessmentId: string, reason: string, correlationId?: string): Promise<void> {
    await this.postgresAdapter.updateFeeStatus(assessmentId, 'FAILED', undefined, reason);
    
    const updated = await this.postgresAdapter.getFeeAssessment(assessmentId);
    if (updated) {
      await this.eventPublisher.emitFeeFailed(updated, reason, correlationId);
      this.logger.warn({ assessmentId, reason }, 'Fee collection failed.');
    }
  }
}

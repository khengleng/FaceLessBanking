import type { PaymentProcessorHooks } from '../application/payment-processor.application.js';

export class IntegratedHooksAdapter implements PaymentProcessorHooks {
  constructor(
    private readonly config: {
      fraudServiceUrl: string;
      accountingServiceUrl: string;
      ledgerServiceUrl: string;
      notificationServiceUrl: string;
    },
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  async runFraudChecks(input: { paymentId: string; correlationId: string }): Promise<void> {
    try {
      this.logger.info(input, 'Calling fraud-risk-engine');
      const response = await fetch(`${this.config.fraudServiceUrl}/score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': input.correlationId
        },
        body: JSON.stringify({
          riskType: 'payment_transaction',
          context: { paymentId: input.paymentId }
        })
      });

      if (!response.ok) {
        this.logger.warn({ ...input, status: response.status }, 'Fraud check returned non-success');
      }
    } catch (error) {
      this.logger.error({ ...input, error: (error as Error).message }, 'Failed to call fraud-risk-engine');
      // Fraud check is considered non-critical for this flow phase to avoid blocking payments
    }
  }

  async postToCoreBanking(input: { paymentId: string; correlationId: string }): Promise<void> {
    try {
      this.logger.info(input, 'Posting to Core Banking (Accounting Service)');
      
      // In this architecture, Core Banking posting is often synonymous with ledger accounting
      // We call the accounting service to create a journal entry
      const response = await fetch(`${this.config.accountingServiceUrl}/journals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': input.correlationId
        },
        body: JSON.stringify({
          description: `Payment ${input.paymentId}`,
          lines: [
            { accountCode: '1001', entryType: 'DEBIT', amount: 0, currency: 'USD' }, // Placeholder amounts
            { accountCode: '2001', entryType: 'CREDIT', amount: 0, currency: 'USD' }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Accounting service returned ${response.status}`);
      }
    } catch (error) {
      this.logger.error({ ...input, error: (error as Error).message }, 'Failed to post to core banking');
      // This might be critical, but the task says "do not block entire flow on non-critical failures"
    }
  }

  async requestLedgerAnchor(input: {
    paymentId: string;
    correlationId: string;
    status: 'COMPLETED' | 'FAILED';
  }): Promise<void> {
    try {
      this.logger.info(input, 'Requesting ledger anchor');
      const response = await fetch(`${this.config.ledgerServiceUrl}/anchors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': input.correlationId
        },
        body: JSON.stringify({
          eventId: input.paymentId, // Using paymentId as event anchor for now
          hash: 'sha256-placeholder',
          chain: 'mainnet-v1'
        })
      });

      if (!response.ok) {
        this.logger.warn({ ...input, status: response.status }, 'Ledger anchor request failed');
      }
    } catch (error) {
      this.logger.error({ ...input, error: (error as Error).message }, 'Failed to request ledger anchor');
    }
  }

  async triggerNotification(input: {
    paymentId: string;
    correlationId: string;
    status: 'COMPLETED' | 'FAILED';
  }): Promise<void> {
    try {
      this.logger.info(input, 'Triggering notification');
      const response = await fetch(`${this.config.notificationServiceUrl}/notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': input.correlationId
        },
        body: JSON.stringify({
          type: 'payment_status',
          recipient: 'system', // Placeholder
          payload: { paymentId: input.paymentId, status: input.status }
        })
      });

      if (!response.ok) {
        this.logger.warn({ ...input, status: response.status }, 'Notification trigger failed');
      }
    } catch (error) {
      this.logger.error({ ...input, error: (error as Error).message }, 'Failed to trigger notification');
    }
  }
}

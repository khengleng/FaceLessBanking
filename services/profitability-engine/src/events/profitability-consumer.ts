import type { ProfitabilityApplication } from '../application/profitability.application.js';
import type { FinancialEventEnvelope } from '../domain/profitability.js';

interface Logger {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
}

export class ProfitabilityConsumer {
  readonly topics = [
    'loan.interest.accrued.v1',
    'fee.collected.v1',
    'payment.status.updated.v1',
    'fx.rate.applied'
  ] as const;

  constructor(
    private readonly application: ProfitabilityApplication,
    private readonly logger: Logger
  ) {}

  async handleEvent(event: FinancialEventEnvelope): Promise<void> {
    try {
      await this.application.processFinancialEvent(event);
    } catch (error: unknown) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : 'unknown_error',
          eventId: event?.metadata?.eventId,
          topic: event?.type
        },
        'Failed to process profitability event'
      );
    }
  }

  async start(): Promise<void> {
    this.logger.info({ topics: [...this.topics] }, 'Profitability consumer start placeholder initialized');
  }
}

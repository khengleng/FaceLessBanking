import { 
  buildInitialPosition, 
  type LiquidityPosition 
} from '../domain/liquidity.js';
import type { PostgresLiquidityAdapter } from '../adapters/postgres-liquidity.adapter.js';

export class LiquidityApplication {
  constructor(
    private readonly postgresAdapter: PostgresLiquidityAdapter,
    private readonly logger: {
      info: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
    }
  ) {}

  async getPositions(): Promise<LiquidityPosition[]> {
    return this.postgresAdapter.listAllPositions();
  }

  async getPositionByCurrency(currency: string): Promise<LiquidityPosition | null> {
    return this.postgresAdapter.getLiquidityPosition(currency);
  }

  async getSummary() {
    const all = await this.postgresAdapter.listAllPositions();
    return all.reduce((acc, pos) => {
      acc[pos.currency] = {
        available: pos.availableCash.toString(),
        total: (pos.availableCash + pos.reservedCash).toString()
      };
      return acc;
    }, {} as Record<string, { available: string; total: string }>);
  }

  async processFinancialEvent(event: {
    metadata: { eventId: string; type: string };
    payload: {
      currency: string;
      amount?: number;
      amountCents?: number;
      direction?: 'IN' | 'OUT';
      type?: string;
    };
  }): Promise<void> {
    const { eventId, type } = event.metadata;
    const { currency } = event.payload;

    if (await this.postgresAdapter.hasProcessedLiquidityEvent(eventId)) {
      this.logger.info({ eventId }, 'Duplicate liquidity event skipped');
      return;
    }

    const rawAmountCents = event.payload.amountCents ?? Math.round((event.payload.amount ?? 0) * 100);
    const amount = BigInt(rawAmountCents);
    const position = await this.postgresAdapter.getLiquidityPosition(currency) 
      ?? buildInitialPosition(currency);

    this.logger.info({ eventId, type, currency, amount: amount.toString() }, 'Processing liquidity update');

    switch (type) {
      case 'payment.status.updated.v1':
        if (event.payload.direction === 'IN') {
          position.availableCash += amount;
        } else {
          position.availableCash -= amount;
        }
        break;

      case 'loan.disbursement.initiated.v1':
        position.availableCash -= amount;
        break;

      case 'loan.repayment.initiated.v1':
        position.availableCash += amount;
        break;

      case 'fee.collected.v1':
        position.availableCash += amount;
        break;

      default:
        this.logger.warn({ type }, 'Unknown event type for liquidity update');
        return;
    }

    await this.postgresAdapter.upsertLiquidityPosition(position);
    await this.postgresAdapter.markLiquidityEventProcessed(eventId);
  }
}

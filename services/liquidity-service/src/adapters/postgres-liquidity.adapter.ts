import type { LiquidityPosition } from '../domain/liquidity.js';

export class PostgresLiquidityAdapter {
  private readonly positions = new Map<string, LiquidityPosition>();
  private readonly processedEvents = new Set<string>();

  async getLiquidityPosition(currency: string): Promise<LiquidityPosition | null> {
    return this.positions.get(currency) ?? null;
  }

  async upsertLiquidityPosition(position: LiquidityPosition): Promise<void> {
    this.positions.set(position.currency, {
      ...position,
      updatedAt: new Date().toISOString()
    });
  }

  async hasProcessedLiquidityEvent(eventId: string): Promise<boolean> {
    return this.processedEvents.has(eventId);
  }

  async markLiquidityEventProcessed(eventId: string): Promise<void> {
    this.processedEvents.add(eventId);
  }

  async listAllPositions(): Promise<LiquidityPosition[]> {
    return Array.from(this.positions.values());
  }
}

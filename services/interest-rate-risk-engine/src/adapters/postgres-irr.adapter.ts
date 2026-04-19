import type { IRRScenarioResult, RateSensitivePosition } from '../domain/irr.js';

export class PostgresIRRAdapter {
  private readonly assetPositions: RateSensitivePosition[] = [];
  private readonly liabilityPositions: RateSensitivePosition[] = [];
  private readonly scenarioResults = new Map<string, IRRScenarioResult>();

  constructor() {
    this.seedMockData();
  }

  private seedMockData() {
    const today = new Date();
    const addDays = (d: number) => {
      const date = new Date(today);
      date.setDate(date.getDate() + d);
      return date.toISOString();
    };

    this.assetPositions.push(
      { instrumentId: 'loan-1', currency: 'USD', amountCents: 1000000n, type: 'ASSET', nextRepricingDate: addDays(15), rateBasisPoints: 500 }, // 5%
      { instrumentId: 'loan-2', currency: 'USD', amountCents: 2000000n, type: 'ASSET', nextRepricingDate: addDays(45), rateBasisPoints: 650 }, // 6.5%
      { instrumentId: 'loan-3', currency: 'USD', amountCents: 5000000n, type: 'ASSET', nextRepricingDate: addDays(500), rateBasisPoints: 400 } // 4%
    );

    this.liabilityPositions.push(
      { instrumentId: 'dep-1', currency: 'USD', amountCents: 1500000n, type: 'LIABILITY', nextRepricingDate: addDays(10), rateBasisPoints: 200 }, // 2%
      { instrumentId: 'dep-2', currency: 'USD', amountCents: 3000000n, type: 'LIABILITY', nextRepricingDate: addDays(120), rateBasisPoints: 100 } // 1%
    );
  }

  async fetchRateSensitiveLoanPositions(): Promise<RateSensitivePosition[]> {
    return this.assetPositions;
  }

  async fetchRateSensitiveDepositPositions(): Promise<RateSensitivePosition[]> {
    return this.liabilityPositions;
  }

  async fetchTreasuryRateSensitivePositions(): Promise<RateSensitivePosition[]> {
    return [];
  }

  async createScenarioResult(result: IRRScenarioResult): Promise<void> {
    this.scenarioResults.set(this.buildScenarioResultKey(result.scenarioId, result.currency), result);
  }

  async getScenarioResult(scenarioId: string, currency: string): Promise<IRRScenarioResult | null> {
    return this.scenarioResults.get(this.buildScenarioResultKey(scenarioId, currency)) ?? null;
  }

  private buildScenarioResultKey(scenarioId: string, currency: string): string {
    return `${scenarioId}:${currency}`;
  }
}

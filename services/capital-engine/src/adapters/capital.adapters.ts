import type { CapitalBase, ExposureInput } from '../domain/capital.js';

export interface LoanDataAdapter {
  getLoanExposures(currency: string): Promise<ExposureInput[]>;
}

export interface BalanceDataAdapter {
  getCapitalBase(currency: string): Promise<CapitalBase>;
}

export class InMemoryLoanDataAdapter implements LoanDataAdapter {
  private readonly exposureByCurrency = new Map<string, ExposureInput[]>([
    ['USD', [
      { assetType: 'LOAN_SECURED', exposure: 1000, currency: 'USD' },
      { assetType: 'LOAN_UNSECURED', exposure: 500, currency: 'USD' },
      { assetType: 'LOAN_RETAIL', exposure: 800, currency: 'USD' }
    ]]
  ]);

  async getLoanExposures(currency: string): Promise<ExposureInput[]> {
    return this.exposureByCurrency.get(currency.toUpperCase()) ?? [];
  }

  setLoanExposures(currency: string, exposures: ExposureInput[]): void {
    this.exposureByCurrency.set(currency.toUpperCase(), exposures.map((item) => ({ ...item, currency: currency.toUpperCase() })));
  }
}

export class InMemoryBalanceDataAdapter implements BalanceDataAdapter {
  private readonly capitalByCurrency = new Map<string, CapitalBase>([
    ['USD', { capital: 1500, currency: 'USD' }]
  ]);

  async getCapitalBase(currency: string): Promise<CapitalBase> {
    return this.capitalByCurrency.get(currency.toUpperCase()) ?? { capital: 0, currency: currency.toUpperCase() };
  }

  setCapitalBase(currency: string, capital: number): void {
    this.capitalByCurrency.set(currency.toUpperCase(), { capital, currency: currency.toUpperCase() });
  }
}

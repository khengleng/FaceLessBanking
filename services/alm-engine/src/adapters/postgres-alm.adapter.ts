import type { RawPosition, ScheduledCashFlow } from '../domain/alm.js';

export class PostgresALMAdapter {
  private readonly loanPositions: RawPosition[] = [
    { currency: 'USD', amountCents: 50000000n, type: 'ASSET' }, // $500k
    { currency: 'EUR', amountCents: 20000000n, type: 'ASSET' }  // €200k
  ];

  private readonly depositPositions: RawPosition[] = [
    { currency: 'USD', amountCents: 45000000n, type: 'LIABILITY' }, // $450k
    { currency: 'EUR', amountCents: 15000000n, type: 'LIABILITY' }  // €150k
  ];

  private readonly treasuryPositions: RawPosition[] = [
    { currency: 'USD', amountCents: 10000000n, type: 'ASSET' }, // $100k
    { currency: 'USD', amountCents: 2000000n, type: 'LIABILITY' } // $20k
  ];

  async fetchLoanPositions(): Promise<RawPosition[]> {
    return this.loanPositions;
  }

  async fetchDepositPositions(): Promise<RawPosition[]> {
    return this.depositPositions;
  }

  async fetchTreasuryPositions(): Promise<RawPosition[]> {
    return this.treasuryPositions;
  }

  async fetchLoanSchedules(): Promise<ScheduledCashFlow[]> {
    const today = new Date();
    const in9Days = new Date(); in9Days.setDate(today.getDate() + 9);
    const in45Days = new Date(); in45Days.setDate(today.getDate() + 45);

    return [
      { amountCents: 500000n, dueDate: in9Days.toISOString(), currency: 'USD', type: 'INFLOW' },
      { amountCents: 1200000n, dueDate: in45Days.toISOString(), currency: 'USD', type: 'INFLOW' }
    ];
  }

  async fetchDepositMaturities(): Promise<ScheduledCashFlow[]> {
    const today = new Date();
    const in5Days = new Date(); in5Days.setDate(today.getDate() + 5);

    return [
      { amountCents: 3000000n, dueDate: in5Days.toISOString(), currency: 'USD', type: 'OUTFLOW' }
    ];
  }
}

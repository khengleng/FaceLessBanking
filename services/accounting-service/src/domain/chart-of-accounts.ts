export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
export type NormalBalance = 'DEBIT' | 'CREDIT';

export interface ChartOfAccount {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  status: 'ACTIVE' | 'INACTIVE';
}

export const CHART_OF_ACCOUNTS: Record<string, ChartOfAccount> = {
  '1100': {
    accountCode: '1100',
    accountName: 'Bank Cash (Funding)',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    status: 'ACTIVE'
  },
  '1200': {
    accountCode: '1200',
    accountName: 'Loans Receivable (Principal)',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    status: 'ACTIVE'
  },
  '2100': {
    accountCode: '2100',
    accountName: 'Customer Deposits (Savings)',
    accountType: 'LIABILITY',
    normalBalance: 'CREDIT',
    status: 'ACTIVE'
  },
  '4100': {
    accountCode: '4100',
    accountName: 'Interest Income',
    accountType: 'INCOME',
    normalBalance: 'CREDIT',
    status: 'ACTIVE'
  },
  '4200': {
    accountCode: '4200',
    accountName: 'Fee Income',
    accountType: 'INCOME',
    normalBalance: 'CREDIT',
    status: 'ACTIVE'
  }
};

export function isValidAccountCode(code: string): boolean {
  return !!CHART_OF_ACCOUNTS[code];
}

import { randomUUID } from 'node:crypto';
import type { JournalLine } from '../domain/journal.js';

export interface AccountingMappingResult {
  journalId: string;
  description: string;
  lines: JournalLine[];
}

export function mapPaymentCompletedToJournal(event: {
  metadata: { eventId: string; correlationId?: string };
  payload: { paymentId: string; amount: number; currency: string };
}): AccountingMappingResult {
  const journalId = randomUUID();
  const { amount, currency, paymentId } = event.payload;

  const lines: JournalLine[] = [
    {
      lineId: randomUUID(),
      journalId,
      accountCode: '1100', // Bank Cash
      entryType: 'DEBIT',
      amount,
      currency
    },
    {
      lineId: randomUUID(),
      journalId,
      accountCode: '2100', // Customer Deposits
      entryType: 'CREDIT',
      amount,
      currency
    }
  ];

  return {
    journalId,
    description: `Payment completion for paymentId: ${paymentId}`,
    lines
  };
}

export function mapLoanDisbursementToJournal(event: {
  metadata: { eventId: string; correlationId?: string };
  payload: { loanAccountId: string; amount: number; currency: string };
}): AccountingMappingResult {
  const journalId = randomUUID();
  const { amount, currency, loanAccountId } = event.payload;

  const lines: JournalLine[] = [
    {
      lineId: randomUUID(),
      journalId,
      accountCode: '1200', // Loans Receivable
      entryType: 'DEBIT',
      amount,
      currency
    },
    {
      lineId: randomUUID(),
      journalId,
      accountCode: '1100', // Bank Cash
      entryType: 'CREDIT',
      amount,
      currency
    }
  ];

  return {
    journalId,
    description: `Loan disbursement for loanAccountId: ${loanAccountId}`,
    lines
  };
}

export function mapLoanInterestAccrualToJournal(event: {
  metadata: { eventId: string; correlationId?: string };
  payload: { loanAccountId: string; accruedInterest: number; currency: string };
}): AccountingMappingResult {
  const journalId = randomUUID();
  const { accruedInterest, currency, loanAccountId } = event.payload;

  const lines: JournalLine[] = [
    {
      lineId: randomUUID(),
      journalId,
      accountCode: '1200', // Loans Receivable
      entryType: 'DEBIT',
      amount: accruedInterest,
      currency
    },
    {
      lineId: randomUUID(),
      journalId,
      accountCode: '4100', // Interest Income
      entryType: 'CREDIT',
      amount: accruedInterest,
      currency
    }
  ];

  return {
    journalId,
    description: `Interest accrual for loanAccountId: ${loanAccountId}`,
    lines
  };
}

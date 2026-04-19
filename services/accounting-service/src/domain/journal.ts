export type JournalLineType = 'DEBIT' | 'CREDIT';

export interface JournalLine {
  lineId: string;
  journalId: string;
  accountCode: string;
  entryType: JournalLineType;
  amount: number;
  currency: string;
}

export interface JournalEntry {
  journalId: string;
  sourceEventId: string;
  sourceEventType: string;
  description: string;
  totalDebit: number;
  totalCredit: number;
  createdAt: string;
}

export interface JournalWithLines {
  entry: JournalEntry;
  lines: JournalLine[];
}

export function isJournalBalanced(lines: JournalLine[]): boolean {
  if (lines.length === 0) return false;

  const totalDebit = lines
    .filter((l) => l.entryType === 'DEBIT')
    .reduce((sum, l) => sum + l.amount, 0);
  
  const totalCredit = lines
    .filter((l) => l.entryType === 'CREDIT')
    .reduce((sum, l) => sum + l.amount, 0);

  return totalDebit === totalCredit && totalDebit > 0;
}

export function buildJournalEntry(params: {
  journalId: string;
  sourceEventId: string;
  sourceEventType: string;
  description: string;
  lines: JournalLine[];
  createdAt?: string;
}): JournalEntry {
  const totalDebit = params.lines
    .filter((l) => l.entryType === 'DEBIT')
    .reduce((sum, l) => sum + l.amount, 0);
  
  const totalCredit = params.lines
    .filter((l) => l.entryType === 'CREDIT')
    .reduce((sum, l) => sum + l.amount, 0);

  return {
    journalId: params.journalId,
    sourceEventId: params.sourceEventId,
    sourceEventType: params.sourceEventType,
    description: params.description,
    totalDebit,
    totalCredit,
    createdAt: params.createdAt || new Date().toISOString()
  };
}

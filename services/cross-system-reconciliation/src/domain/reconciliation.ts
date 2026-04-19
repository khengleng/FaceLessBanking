export type ReconciliationStatus = 'MATCH' | 'MISMATCH';

export type SystemPairKey =
  | 'ledger_vs_accounting'
  | 'payments_vs_balances'
  | 'internal_vs_external';

export interface ReconciliationResult {
  sourceSystem: string;
  targetSystem: string;
  status: ReconciliationStatus;
  discrepancyAmount: number;
}

export interface ReconciliationRunSummary {
  runId: string;
  results: ReconciliationResult[];
  hasMismatch: boolean;
  createdAt: string;
}

export interface SystemComparisonSnapshot {
  pair: SystemPairKey;
  sourceSystem: string;
  targetSystem: string;
  sourceAmount: number;
  targetAmount: number;
}

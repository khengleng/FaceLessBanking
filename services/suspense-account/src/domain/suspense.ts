export type SuspenseStatus = 'SUSPENSE' | 'CLEARED';

export interface SuspenseEntry {
  entryId: string;
  amount: number;
  reason: string;
  status: SuspenseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSuspenseEntryInput {
  amount: number;
  reason: string;
}

import { z } from 'zod';

export const ManualJournalLineSchema = z.object({
  accountCode: z.string().min(4),
  entryType: z.enum(['DEBIT', 'CREDIT']),
  amount: z.number().positive(),
  currency: z.string().length(3)
});

export const CreateManualJournalSchema = z.object({
  description: z.string().min(3),
  lines: z.array(ManualJournalLineSchema).min(2)
});

export type CreateManualJournalRequestDto = z.infer<typeof CreateManualJournalSchema>;

export interface JournalResponseDto {
  journalId: string;
  sourceEventId: string;
  sourceEventType: string;
  description: string;
  totalDebit: number;
  totalCredit: number;
  createdAt: string;
  lines: Array<{
    lineId: string;
    accountCode: string;
    entryType: 'DEBIT' | 'CREDIT';
    amount: number;
    currency: string;
  }>;
}

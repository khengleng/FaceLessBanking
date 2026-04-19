export type LetterOfCreditStatus = 'APPLICATION' | 'APPROVED' | 'ISSUED' | 'SETTLED' | 'CLOSED';

export interface LetterOfCredit {
  lcId: string;
  applicant: string;
  beneficiary: string;
  amount: number;
  currency: string;
  status: LetterOfCreditStatus;
  createdAt: string;
}

export interface CreateLCInput {
  applicant: string;
  beneficiary: string;
  amount: number;
  currency: string;
}

export const LC_TRANSITIONS: Record<LetterOfCreditStatus, LetterOfCreditStatus[]> = {
  APPLICATION: ['APPROVED'],
  APPROVED: ['ISSUED'],
  ISSUED: ['SETTLED'],
  SETTLED: ['CLOSED'],
  CLOSED: []
};

export function canTransition(from: LetterOfCreditStatus, to: LetterOfCreditStatus): boolean {
  return LC_TRANSITIONS[from].includes(to);
}

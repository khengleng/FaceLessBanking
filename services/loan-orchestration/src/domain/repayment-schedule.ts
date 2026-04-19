import { randomUUID } from 'node:crypto';

export type LoanRepaymentSchedule = {
  scheduleId: string;
  loanAccountId: string;
  scheduleType: 'FIXED_INSTALLMENT_V1';
  generatedAt: string;
};

export type LoanRepaymentScheduleEntry = {
  entryId: string;
  scheduleId: string;
  installmentNumber: number;
  dueDate: string;
  principalDue: number;
  interestDue: number;
  totalDue: number;
  outstandingPrincipalAfter: number;
  status: 'PENDING';
};

export type FixedInstallmentInput = {
  loanAccountId: string;
  principalAmount: number;
  annualInterestRateBps: number;
  termMonths: number;
  firstDueDate: string;
  generatedAt: string;
};

export type FixedInstallmentOutput = {
  schedule: LoanRepaymentSchedule;
  entries: LoanRepaymentScheduleEntry[];
};

export function generateFixedInstallmentSchedule(input: FixedInstallmentInput): FixedInstallmentOutput {
  const scheduleId = randomUUID();
  const schedule: LoanRepaymentSchedule = {
    scheduleId,
    loanAccountId: input.loanAccountId,
    scheduleType: 'FIXED_INSTALLMENT_V1',
    generatedAt: input.generatedAt
  };

  const entries: LoanRepaymentScheduleEntry[] = [];
  let outstandingPrincipal = input.principalAmount;

  const monthlyRate = (input.annualInterestRateBps / 10_000) / 12;
  const fixedInstallment = calculateFixedInstallment(input.principalAmount, input.termMonths, monthlyRate);

  for (let installmentNumber = 1; installmentNumber <= input.termMonths; installmentNumber += 1) {
    const dueDate = addMonthsIsoDate(input.firstDueDate, installmentNumber - 1);
    const interestDue = Math.round(outstandingPrincipal * monthlyRate);

    let principalDue = Math.max(0, fixedInstallment - interestDue);
    if (installmentNumber === input.termMonths || principalDue > outstandingPrincipal) {
      principalDue = outstandingPrincipal;
    }

    const totalDue = principalDue + interestDue;
    const outstandingPrincipalAfter = outstandingPrincipal - principalDue;

    entries.push({
      entryId: randomUUID(),
      scheduleId,
      installmentNumber,
      dueDate,
      principalDue,
      interestDue,
      totalDue,
      outstandingPrincipalAfter,
      status: 'PENDING'
    });

    outstandingPrincipal = outstandingPrincipalAfter;
  }

  return {
    schedule,
    entries
  };
}

function calculateFixedInstallment(principalAmount: number, termMonths: number, monthlyRate: number): number {
  if (monthlyRate <= 0) {
    return Math.round(principalAmount / termMonths);
  }

  const denominator = 1 - (1 + monthlyRate) ** (-termMonths);
  const payment = principalAmount * monthlyRate / denominator;
  return Math.round(payment);
}

function addMonthsIsoDate(baseDateIso: string, monthsToAdd: number): string {
  const base = new Date(baseDateIso);
  if (Number.isNaN(base.getTime())) {
    return new Date().toISOString();
  }

  const result = new Date(base.toISOString());
  result.setUTCMonth(result.getUTCMonth() + monthsToAdd);
  return result.toISOString();
}

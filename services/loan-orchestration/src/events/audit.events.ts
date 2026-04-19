export type AuditRecord = {
  action: 'loan.create';
  loanId: string;
  idempotencyKey: string;
  timestamp: string;
};

export class AuditEventsService {
  public readonly records: AuditRecord[] = [];

  async createLoanAuditRecord(loanId: string, idempotencyKey: string): Promise<void> {
    this.records.push({
      action: 'loan.create',
      loanId,
      idempotencyKey,
      timestamp: new Date().toISOString()
    });
  }
}

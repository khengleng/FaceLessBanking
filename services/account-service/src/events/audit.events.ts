export type AuditRecord = {
  action: 'account.create' | 'account.activate';
  accountId: string;
  idempotencyKey: string;
  timestamp: string;
};

export class AuditEventsService {
  public readonly records: AuditRecord[] = [];

  async createAccountAuditRecord(accountId: string, idempotencyKey: string): Promise<void> {
    this.records.push({
      action: 'account.create',
      accountId,
      idempotencyKey,
      timestamp: new Date().toISOString()
    });
  }

  async createAccountFromCustomerAuditRecord(input: {
    accountId: string;
    customerId: string;
    sourceEventId: string;
    correlationId: string;
  }): Promise<void> {
    this.records.push({
      action: 'account.create',
      accountId: input.accountId,
      idempotencyKey: input.sourceEventId,
      timestamp: new Date().toISOString()
    });
    void input.customerId;
    void input.correlationId;
  }

  async createAccountActivatedAuditRecord(input: {
    accountId: string;
    idempotencyKey: string;
  }): Promise<void> {
    this.records.push({
      action: 'account.activate',
      accountId: input.accountId,
      idempotencyKey: input.idempotencyKey,
      timestamp: new Date().toISOString()
    });
  }
}

import type { AiAction } from '../domain/ai-request.js';

export type AiAuditRecord = {
  action: AiAction;
  status: 'allowed' | 'blocked';
  inputLength: number;
  timestamp: string;
};

export class AuditLogAdapter {
  public readonly records: AiAuditRecord[] = [];

  async append(record: AiAuditRecord): Promise<void> {
    // Intentionally stores metadata only; no raw PII/request body persisted in this placeholder.
    this.records.push(record);
  }
}

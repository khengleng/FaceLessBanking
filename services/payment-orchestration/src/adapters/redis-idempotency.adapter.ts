export type IdempotencyRecord = {
  paymentId: string;
  status: string;
  correlationId: string;
};

export class RedisIdempotencyAdapter {
  private readonly idempotencyRecords = new Map<string, IdempotencyRecord>();

  async getIdempotencyRecord(idempotencyKey: string): Promise<IdempotencyRecord | null> {
    return this.idempotencyRecords.get(idempotencyKey) ?? null;
  }

  async setIdempotencyRecord(
    idempotencyKey: string,
    record: IdempotencyRecord
  ): Promise<void> {
    this.idempotencyRecords.set(idempotencyKey, record);
  }
}

export class RedisIdempotencyAdapter {
  private readonly idempotencyKeys = new Map<string, string>();

  async getAccountIdByKey(idempotencyKey: string): Promise<string | null> {
    return this.idempotencyKeys.get(idempotencyKey) ?? null;
  }

  async saveKey(idempotencyKey: string, accountId: string): Promise<void> {
    this.idempotencyKeys.set(idempotencyKey, accountId);
  }
}

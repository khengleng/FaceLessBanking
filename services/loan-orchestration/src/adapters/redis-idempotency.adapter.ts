export class RedisIdempotencyAdapter {
  private readonly idempotencyKeys = new Map<string, string>();

  async getReferenceByKey(idempotencyKey: string): Promise<string | null> {
    return this.idempotencyKeys.get(idempotencyKey) ?? null;
  }

  async saveKey(idempotencyKey: string, referenceId: string): Promise<void> {
    this.idempotencyKeys.set(idempotencyKey, referenceId);
  }
}

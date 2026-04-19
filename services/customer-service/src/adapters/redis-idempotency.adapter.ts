export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    mode: 'EX',
    seconds: number
  ): Promise<unknown>;
}

export class RedisIdempotencyAdapter {
  private readonly PREFIX = 'idempotency:customer:';
  private readonly TTL_SECONDS = 24 * 60 * 60; // 24 hours

  constructor(private readonly redis: RedisClient) {}

  async getCustomerIdByKey(idempotencyKey: string): Promise<string | null> {
    const key = `${this.PREFIX}${idempotencyKey}`;
    return this.redis.get(key);
  }

  async saveKey(idempotencyKey: string, customerId: string): Promise<void> {
    const key = `${this.PREFIX}${idempotencyKey}`;
    await this.redis.set(key, customerId, 'EX', this.TTL_SECONDS);
  }
}

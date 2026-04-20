import { Redis } from 'ioredis';

export type IdempotencyRecord = {
  paymentId: string;
  status: string;
  correlationId: string;
};

export class RedisIdempotencyAdapter {
  private readonly redis: Redis;

  constructor(redisOrUrl?: Redis | string) {
    if (typeof redisOrUrl === 'string') {
      this.redis = new Redis(redisOrUrl);
    } else {
      this.redis = redisOrUrl ?? new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    }
  }

  async getIdempotencyRecord(idempotencyKey: string): Promise<IdempotencyRecord | null> {
    const key = `idempotency:payment:${idempotencyKey}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async setIdempotencyRecord(
    idempotencyKey: string,
    record: IdempotencyRecord
  ): Promise<void> {
    const key = `idempotency:payment:${idempotencyKey}`;
    // Store for 24 hours
    await this.redis.set(key, JSON.stringify(record), 'EX', 86400);
  }

  async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }
}

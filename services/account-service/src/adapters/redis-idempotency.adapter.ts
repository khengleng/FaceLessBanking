import { Redis } from 'ioredis';

export class RedisIdempotencyAdapter {
  private readonly redis: Redis;

  constructor(redisOrUrl?: Redis | string) {
    if (typeof redisOrUrl === 'string') {
      this.redis = new Redis(redisOrUrl);
    } else {
      this.redis = redisOrUrl ?? new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    }
  }

  async getAccountIdByKey(idempotencyKey: string): Promise<string | null> {
    const key = `idempotency:account:${idempotencyKey}`;
    return await this.redis.get(key);
  }

  async saveKey(idempotencyKey: string, accountId: string): Promise<void> {
    const key = `idempotency:account:${idempotencyKey}`;
    // Store for 24 hours by default
    await this.redis.set(key, accountId, 'EX', 86400);
  }

  async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }
}

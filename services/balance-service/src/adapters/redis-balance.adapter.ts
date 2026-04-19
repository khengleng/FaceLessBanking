import type { BalanceSnapshot } from '../domain/balance.js';

export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<unknown>;
}

export class RedisBalanceAdapter {
  private readonly keyPrefix: string;

  private readonly defaultTtlSeconds: number;

  constructor(
    private readonly redis: RedisClient,
    config?: {
      keyPrefix?: string;
      ttlSeconds?: number;
    }
  ) {
    this.keyPrefix = config?.keyPrefix ?? 'balance:';
    this.defaultTtlSeconds = config?.ttlSeconds ?? 60;
  }

  async getBalanceSnapshot(accountId: string): Promise<BalanceSnapshot | null> {
    const raw = await this.redis.get(this.key(accountId));
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as BalanceSnapshot;
  }

  async setBalanceSnapshot(snapshot: BalanceSnapshot, ttlSeconds?: number): Promise<void> {
    await this.redis.set(
      this.key(snapshot.accountId),
      JSON.stringify(snapshot),
      'EX',
      ttlSeconds ?? this.defaultTtlSeconds
    );
  }

  private key(accountId: string): string {
    return `${this.keyPrefix}${accountId}`;
  }
}

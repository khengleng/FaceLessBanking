import { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import type { PostgresBalanceProjectionAdapter } from '../adapters/postgres-balance-projection.adapter.js';
import type { RedisBalanceAdapter } from '../adapters/redis-balance.adapter.js';
import { BalanceProjectionConsumer } from '../events/balance-projection.consumer.js';
import type { BalanceMetrics } from '../events/metrics.js';

import { BalanceProjectionUpdaterApplication } from './balance-projection-updater.application.js';

export function buildBalanceProjectionUpdater(deps: {
  postgresAdapter: PostgresBalanceProjectionAdapter;
  redisAdapter: RedisBalanceAdapter;
  metrics: BalanceMetrics;
  cacheTtlSeconds: number;
  logger?: {
    info: (payload: Record<string, unknown>, message: string) => void;
    warn: (payload: Record<string, unknown>, message: string) => void;
    error: (payload: Record<string, unknown>, message: string) => void;
  };
  kafkaConsumer?: KafkaConsumerAdapter;
}): {
  updater: BalanceProjectionUpdaterApplication;
  consumer: BalanceProjectionConsumer;
} {
  const logger = deps.logger ?? {
    info: (payload: Record<string, unknown>, message: string): void => {
      void payload;
      void message;
    },
    warn: (payload: Record<string, unknown>, message: string): void => {
      void payload;
      void message;
    },
    error: (payload: Record<string, unknown>, message: string): void => {
      void payload;
      void message;
    }
  };

  const updater = new BalanceProjectionUpdaterApplication(
    deps.postgresAdapter,
    deps.redisAdapter,
    deps.metrics,
    deps.cacheTtlSeconds,
    logger
  );

  const consumer = new BalanceProjectionConsumer(
    deps.kafkaConsumer ?? new KafkaConsumerAdapter(),
    updater
  );

  return { updater, consumer };
}

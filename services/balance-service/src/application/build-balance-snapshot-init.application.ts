import { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import type { PostgresBalanceProjectionAdapter } from '../adapters/postgres-balance-projection.adapter.js';
import type { RedisBalanceAdapter } from '../adapters/redis-balance.adapter.js';
import { BalanceSnapshotInitConsumer } from '../events/balance-snapshot-init.consumer.js';
import type { BalanceMetrics } from '../events/metrics.js';

import { BalanceSnapshotInitApplication } from './balance-snapshot-init.application.js';

export function buildBalanceSnapshotInit(deps: {
  postgresAdapter: PostgresBalanceProjectionAdapter;
  redisAdapter: RedisBalanceAdapter;
  metrics: BalanceMetrics;
  cacheTtlSeconds: number;
  defaultCurrency: string;
  logger?: {
    info: (payload: Record<string, unknown>, message: string) => void;
    warn: (payload: Record<string, unknown>, message: string) => void;
    error: (payload: Record<string, unknown>, message: string) => void;
  };
  kafkaConsumer?: KafkaConsumerAdapter;
}): {
  application: BalanceSnapshotInitApplication;
  consumer: BalanceSnapshotInitConsumer;
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

  const application = new BalanceSnapshotInitApplication(
    deps.postgresAdapter,
    deps.redisAdapter,
    deps.metrics,
    deps.cacheTtlSeconds,
    logger,
    deps.defaultCurrency
  );

  const consumer = new BalanceSnapshotInitConsumer(
    deps.kafkaConsumer ?? new KafkaConsumerAdapter(),
    application
  );

  return { application, consumer };
}

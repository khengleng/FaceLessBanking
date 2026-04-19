import { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import type { PostgresSearchIndexAdapter } from '../adapters/postgres-search-index.adapter.js';
import { SearchIndexConsumer } from '../events/search-index.consumer.js';
import type { SearchIndexingMetrics } from '../events/metrics.js';

import { SearchEventIndexerApplication } from './search-event-indexer.application.js';

export function buildSearchEventIndexerApplication(deps: {
  postgresAdapter: PostgresSearchIndexAdapter;
  metrics: SearchIndexingMetrics;
  logger?: {
    info: (payload: Record<string, unknown>, message: string) => void;
    warn: (payload: Record<string, unknown>, message: string) => void;
    error: (payload: Record<string, unknown>, message: string) => void;
  };
  kafkaConsumer?: KafkaConsumerAdapter;
}): {
  indexer: SearchEventIndexerApplication;
  consumer: SearchIndexConsumer;
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

  const indexer = new SearchEventIndexerApplication(
    deps.postgresAdapter,
    deps.metrics,
    logger
  );

  const consumer = new SearchIndexConsumer(
    deps.kafkaConsumer ?? new KafkaConsumerAdapter(),
    indexer
  );

  return { indexer, consumer };
}

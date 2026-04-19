import { PostgresEkycAdapter } from '../adapters/postgres-ekyc.adapter.js';
import {
  SumsubWebhookVerifierAdapterPlaceholder,
  type SumsubWebhookVerifierAdapter
} from '../adapters/sumsub-webhook-verifier.adapter.js';
import { EkycEventsPublisher } from '../events/ekyc.events.js';
import { EkycWebhookMetrics } from '../events/metrics.js';
import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';

import { SumsubWebhookApplication } from './sumsub-webhook.application.js';

export function buildSumsubWebhookApplication(deps: {
  postgresAdapter?: PostgresEkycAdapter;
  verifier?: SumsubWebhookVerifierAdapter;
  eventsPublisher?: EkycEventsPublisher;
  metrics?: EkycWebhookMetrics;
  logger?: {
    info: (payload: Record<string, unknown>, message: string) => void;
    warn: (payload: Record<string, unknown>, message: string) => void;
    error: (payload: Record<string, unknown>, message: string) => void;
  };
} = {}): {
  application: SumsubWebhookApplication;
  metrics: EkycWebhookMetrics;
} {
  const postgresAdapter = deps.postgresAdapter ?? new PostgresEkycAdapter();
  const verifier = deps.verifier ?? new SumsubWebhookVerifierAdapterPlaceholder();
  const eventsPublisher = deps.eventsPublisher ?? new EkycEventsPublisher(new KafkaProducerAdapter());
  const metrics = deps.metrics ?? new EkycWebhookMetrics();

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

  return {
    application: new SumsubWebhookApplication(
      postgresAdapter,
      verifier,
      eventsPublisher,
      metrics,
      logger
    ),
    metrics
  };
}

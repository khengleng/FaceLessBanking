import { DocumentStorageAdapterStub } from '../adapters/document-storage.adapter.js';
import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { PostgresEkycAdapter } from '../adapters/postgres-ekyc.adapter.js';
import { AmlProviderAdapterStub } from '../adapters/provider-aml.adapter.js';
import { LivenessProviderAdapterStub } from '../adapters/provider-liveness.adapter.js';
import { OcrProviderAdapterStub } from '../adapters/provider-ocr.adapter.js';
import { EkycEventsPublisher } from '../events/ekyc.events.js';

import { EkycApplication } from './ekyc.application.js';

export function buildEkycApplication(): EkycApplication {
  return buildEkycApplicationWithDeps({});
}

export function buildEkycApplicationWithDeps(deps: {
  postgresAdapter?: PostgresEkycAdapter;
  ocrProvider?: OcrProviderAdapterStub;
  livenessProvider?: LivenessProviderAdapterStub;
  amlProvider?: AmlProviderAdapterStub;
  documentStorage?: DocumentStorageAdapterStub;
  kafkaProducer?: KafkaProducerAdapter;
  ekycEvents?: EkycEventsPublisher;
}): EkycApplication {
  const postgresAdapter = deps.postgresAdapter ?? new PostgresEkycAdapter();
  const ocrProvider = deps.ocrProvider ?? new OcrProviderAdapterStub();
  const livenessProvider = deps.livenessProvider ?? new LivenessProviderAdapterStub();
  const amlProvider = deps.amlProvider ?? new AmlProviderAdapterStub();
  const documentStorage = deps.documentStorage ?? new DocumentStorageAdapterStub();
  const kafkaProducer = deps.kafkaProducer ?? new KafkaProducerAdapter();
  const ekycEvents = deps.ekycEvents ?? new EkycEventsPublisher(kafkaProducer);

  return new EkycApplication(
    postgresAdapter,
    ocrProvider,
    livenessProvider,
    amlProvider,
    documentStorage,
    ekycEvents
  );
}

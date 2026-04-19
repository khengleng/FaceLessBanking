import { BlockchainAdapterStub } from '../adapters/blockchain.adapter.js';
import { KafkaConsumerAdapter } from '../adapters/kafka-consumer.adapter.js';
import { KafkaProducerAdapter } from '../adapters/kafka-producer.adapter.js';
import { PostgresLedgerAdapter } from '../adapters/postgres-ledger.adapter.js';
import { LedgerEventsPublisher } from '../events/ledger.events.js';

import { LedgerApplication } from './ledger.application.js';

export async function buildLedgerApplication(): Promise<LedgerApplication> {
  const postgresAdapter = new PostgresLedgerAdapter();
  const blockchainAdapter = new BlockchainAdapterStub();
  const kafkaProducer = new KafkaProducerAdapter();
  const kafkaConsumer = new KafkaConsumerAdapter();
  const ledgerEvents = new LedgerEventsPublisher(kafkaProducer);

  await kafkaConsumer.subscribe('audit.events');

  return new LedgerApplication(postgresAdapter, blockchainAdapter, ledgerEvents);
}

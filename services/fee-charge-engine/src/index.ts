import { Kafka } from 'kafkajs';
import { buildApp } from './app.js';
import { FeeEventConsumer } from './events/fee-consumer.js';

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const PORT = Number(process.env.PORT) || 3000;

const kafka = new Kafka({ clientId: 'fee-charge-engine', brokers: KAFKA_BROKERS });
const producer = kafka.producer();

async function start() {
  await producer.connect();
  
  const { app, feeApplication, collectionApplication } = buildApp({
    kafkaProducer: producer
  });

  const consumer = new FeeEventConsumer(kafka, feeApplication, collectionApplication, app.log);
  await consumer.start();

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Fee charge engine listening on port ${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

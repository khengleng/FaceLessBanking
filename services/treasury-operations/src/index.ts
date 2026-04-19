import { Kafka } from 'kafkajs';
import { buildApp } from './app.js';

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const PORT = Number(process.env.PORT) || 3000;

async function start() {
  const kafka = new Kafka({ clientId: 'treasury-operations', brokers: KAFKA_BROKERS });
  const producer = kafka.producer();
  try {
    await producer.connect();
  } catch (error) {
    console.warn('Kafka unavailable at startup; continuing in degraded mode', error);
  }

  const { app } = buildApp({
    producer,
    logger: true
  });

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Treasury Operations Service listening on port ${PORT}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();

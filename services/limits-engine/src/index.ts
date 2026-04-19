import { Kafka } from 'kafkajs';
import { buildApp } from './app.js';
import { LimitsConsumer } from './events/limits-consumer.js';

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const PORT = Number(process.env.PORT) || 3000;

async function start() {
  const kafka = new Kafka({ clientId: 'limits-engine', brokers: KAFKA_BROKERS });
  const producer = kafka.producer();
  await producer.connect();

  const { app, application } = buildApp({
    producer,
    logger: true
  });

  const consumer = new LimitsConsumer(kafka, application, app.log);
  await consumer.start();

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Limits Engine listening on port ${PORT}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();

import { Kafka } from 'kafkajs';
import { buildApp } from './app.js';

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const PORT = Number(process.env.PORT) || 3000;

const kafka = new Kafka({ clientId: 'daily-close-orchestration', brokers: KAFKA_BROKERS });
const producer = kafka.producer();

async function start() {
  await producer.connect();
  
  const { app } = buildApp({
    kafkaProducer: producer
  });

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Daily close orchestrator listening on port ${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

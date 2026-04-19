import pg from 'pg';
import { Kafka } from 'kafkajs';
import { buildApp } from './app.js';
import { AccountingConsumer } from './events/accounting-consumer.js';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/accounting_db';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const PORT = Number(process.env.PORT) || 3000;

const pool = new Pool({ connectionString: DATABASE_URL });
const kafka = new Kafka({ clientId: 'accounting-service', brokers: KAFKA_BROKERS });
const producer = kafka.producer();

async function start() {
  await producer.connect();
  
  const { app, accountingApplication } = buildApp({
    dbPool: pool,
    kafkaProducer: producer
  });

  const consumer = new AccountingConsumer(kafka, accountingApplication, app.log);
  await consumer.start();

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Accounting service listening on port ${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

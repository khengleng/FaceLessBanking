import { Kafka } from 'kafkajs';
import { createApp } from './app.js';
import { LiquidityConsumer } from './events/liquidity-consumer.js';
import { LiquidityApplication } from './application/liquidity.application.js';
import { PostgresLiquidityAdapter } from './adapters/postgres-liquidity.adapter.js';

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const PORT = Number(process.env.PORT) || 3000;

async function start() {
  const app = createApp();
  
  const kafka = new Kafka({ clientId: 'liquidity-service', brokers: KAFKA_BROKERS });
  const postgresAdapter = new PostgresLiquidityAdapter();
  const application = new LiquidityApplication(postgresAdapter, app.log);
  
  const consumer = new LiquidityConsumer(kafka, application, app.log);
  await consumer.start();

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Liquidity Service listening on port ${PORT}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();

import { createApp } from './app.js';

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  const app = createApp();
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Ops Dashboard Service listening on port ${PORT}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();

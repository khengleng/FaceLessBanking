import Fastify, { type FastifyInstance } from 'fastify';

import { buildLedgerApplication } from './application/build-ledger.application.js';
import { getHealth } from './controllers/health.controller.js';
import { buildLedgerController } from './controllers/ledger.controller.js';

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  const ledgerApplication = await buildLedgerApplication();
  const ledgerController = buildLedgerController(ledgerApplication);

  app.get('/health', getHealth);
  app.post('/ledger/anchors', ledgerController.createAnchor);
  app.get('/ledger/anchors/:anchorId', ledgerController.getAnchorById);
  app.get('/ledger/proofs/:eventId', ledgerController.getProofByEventId);

  return app;
}

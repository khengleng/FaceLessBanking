import Fastify, { type FastifyInstance } from 'fastify';

import { buildLoanApplication } from './application/build-loan.application.js';
import { getHealth } from './controllers/health.controller.js';
import { buildLoanController } from './controllers/loan.controller.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  const loanApplication = buildLoanApplication();
  const loanController = buildLoanController(loanApplication);

  app.get('/health', getHealth);
  app.post('/loans', loanController.createLoan);
  app.get('/loans/:loanId', loanController.getLoanById);
  app.post('/loans/:loanAccountId/repayments', loanController.initiateRepayment);

  return app;
}

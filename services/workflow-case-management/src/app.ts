import Fastify, { type FastifyInstance } from 'fastify';

import type { WorkflowCaseManagementApplication } from './application/workflow-case-management.application.js';
import { buildWorkflowCaseManagementApplication } from './application/build-workflow-case-management.application.js';
import { getHealth } from './controllers/health.controller.js';
import { buildWorkflowCaseManagementController } from './controllers/workflow-case-management.controller.js';
import { PostgresCaseAdapter } from './adapters/postgres-case.adapter.js';
import { CaseEventsPublisher } from './events/case.events.js';
import { KafkaProducerAdapter } from './adapters/kafka-producer.adapter.js';
import { MakerCheckerApplication } from './application/maker-checker.application.js';
import { buildMakerCheckerController } from './controllers/maker-checker.controller.js';
import { DisputeApplication } from './application/dispute.application.js';
import { buildDisputeController } from './controllers/dispute.controller.js';

export function createApp(options?: {
  application?: WorkflowCaseManagementApplication;
}): FastifyInstance {
  const app = Fastify({ logger: false });

  const application = options?.application ?? buildWorkflowCaseManagementApplication();
  const controller = buildWorkflowCaseManagementController(application);

  // In a real scenario, we'd share the same adapters
  const postgresAdapter = new PostgresCaseAdapter();
  const eventsPublisher = new CaseEventsPublisher(new KafkaProducerAdapter());
  
  const makerCheckerApp = new MakerCheckerApplication(
    postgresAdapter,
    eventsPublisher,
    app.log as unknown as {
      info: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
    }
  );
  const makerCheckerController = buildMakerCheckerController(makerCheckerApp);

  const disputeApp = new DisputeApplication(
    postgresAdapter,
    eventsPublisher,
    app.log as unknown as {
      info: (payload: Record<string, unknown>, message: string) => void;
      error: (payload: Record<string, unknown>, message: string) => void;
      warn: (payload: Record<string, unknown>, message: string) => void;
    }
  );
  const disputeController = buildDisputeController(disputeApp);

  app.get('/health', getHealth);
  app.post('/cases', controller.createCase);
  app.get('/cases/onboarding-review', controller.listOnboardingCases);
  app.get('/cases', controller.getCaseByEntity);
  app.get('/cases/:caseId', controller.getCase);
  app.post('/cases/:caseId/actions', controller.recordCaseAction);

  app.post('/maker-checker/evaluate', makerCheckerController.evaluateAction);
  app.post('/maker-checker/policies', makerCheckerController.createPolicy);
  app.get('/maker-checker/policies/:policyId', makerCheckerController.getPolicy);

  app.post('/disputes', disputeController.createDispute);
  app.get('/disputes/:disputeId', disputeController.getDispute);
  app.post('/disputes/:disputeId/escalate', disputeController.escalateDispute);
  app.post('/disputes/:disputeId/resolve', disputeController.resolveDispute);

  return app;
}

import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AMLMonitoringApplication } from '../application/aml-monitoring.application.js';

type GetAlertByIdRequest = FastifyRequest<{
  Params: {
    alertId: string;
  };
}>;

export function buildAmlMonitoringController(application: AMLMonitoringApplication) {
  async function listAlerts(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const alerts = await application.listAlerts();

    reply.code(200).send({
      success: true,
      data: {
        items: alerts
      }
    });
  }

  async function getAlertById(request: GetAlertByIdRequest, reply: FastifyReply): Promise<void> {
    const alert = await application.getAlertById(request.params.alertId);
    if (!alert) {
      reply.code(404).send({
        success: false,
        error: 'aml_alert_not_found'
      });
      return;
    }

    reply.code(200).send({
      success: true,
      data: alert
    });
  }

  return {
    listAlerts,
    getAlertById
  };
}

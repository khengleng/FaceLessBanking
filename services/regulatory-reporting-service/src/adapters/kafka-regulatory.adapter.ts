import type { RegulatoryReport } from '../domain/regulatory-report.js';

export type PublishedEvent = {
  type: string;
  metadata: {
    eventId: string;
    correlationId: string;
    timestamp: string;
    producer: string;
  };
  payload: Record<string, string | number | boolean | null>;
};

export class KafkaRegulatoryAdapter {
  readonly publishedEvents: PublishedEvent[] = [];

  async publishRegulatoryReportGenerated(input: {
    report: RegulatoryReport;
    correlationId: string;
  }): Promise<void> {
    this.publishedEvents.push({
      type: 'regulatory.report.generated.v1',
      metadata: {
        eventId: `evt-${input.report.reportId}-generated`,
        correlationId: input.correlationId,
        timestamp: new Date().toISOString(),
        producer: 'regulatory-reporting-service'
      },
      payload: {
        reportId: input.report.reportId,
        reportType: input.report.reportType,
        status: input.report.status,
        recordCount: input.report.recordCount,
        generatedAt: input.report.generatedAt
      }
    });
  }

  async publishRegulatoryReportFailed(input: {
    report: RegulatoryReport;
    correlationId: string;
  }): Promise<void> {
    this.publishedEvents.push({
      type: 'regulatory.report.failed.v1',
      metadata: {
        eventId: `evt-${input.report.reportId}-failed`,
        correlationId: input.correlationId,
        timestamp: new Date().toISOString(),
        producer: 'regulatory-reporting-service'
      },
      payload: {
        reportId: input.report.reportId,
        reportType: input.report.reportType,
        status: input.report.status,
        generatedAt: input.report.generatedAt,
        errorCode: String(input.report.metadata.errorCode ?? 'UNKNOWN')
      }
    });
  }
}

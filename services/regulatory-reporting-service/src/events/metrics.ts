export class RegulatoryReportingMetrics {
  reportsGenerated = 0;

  reportsFailed = 0;

  generationLatencyByReportType: Record<string, number[]> = {};

  recordGenerated(reportType: string, latencyMs: number): void {
    this.reportsGenerated += 1;
    this.generationLatencyByReportType[reportType] ??= [];
    this.generationLatencyByReportType[reportType].push(latencyMs);
  }

  recordFailed(reportType: string, latencyMs: number): void {
    this.reportsFailed += 1;
    this.generationLatencyByReportType[reportType] ??= [];
    this.generationLatencyByReportType[reportType].push(latencyMs);
  }
}

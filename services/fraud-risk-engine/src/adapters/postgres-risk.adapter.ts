import type { RiskAlert } from '../domain/risk-alert.js';

export class PostgresRiskAdapter {
  private readonly alertsById = new Map<string, RiskAlert>();

  async insertAlert(alert: RiskAlert): Promise<void> {
    this.alertsById.set(alert.alertId, alert);
  }

  async findAlertById(alertId: string): Promise<RiskAlert | null> {
    return this.alertsById.get(alertId) ?? null;
  }
}

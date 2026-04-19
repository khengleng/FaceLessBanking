export type AMLAlertStatus = 'OPEN' | 'UNDER_REVIEW' | 'CLOSED';

export type AMLAlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export type AMLAlert = {
  alertId: string;
  sourceEventId: string;
  entityType: string;
  entityId: string;
  ruleName: string;
  severity: AMLAlertSeverity;
  status: AMLAlertStatus;
  reason: string;
  createdAt: string;
};

export type AMLAlertCandidate = {
  sourceEventId: string;
  entityType: string;
  entityId: string;
  ruleName: string;
  severity: AMLAlertSeverity;
  reason: string;
};

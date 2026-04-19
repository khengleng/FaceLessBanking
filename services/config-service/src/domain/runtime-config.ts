export type ConfigValue = string | number | boolean | null;

export type ConfigEntry = {
  key: string;
  value: ConfigValue;
  version: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  reason: string;
};

export type ConfigAuditRecord = {
  auditId: string;
  key: string;
  oldValue: ConfigValue | null;
  newValue: ConfigValue;
  oldVersion: number;
  newVersion: number;
  changedAt: string;
  changedBy: string;
  reason: string;
};

export type RuntimeConfig = {
  entries: ConfigEntry[];
  updatedAt: string;
};

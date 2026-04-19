export type SystemHealth = {
  status: 'OK';
  uptimeSeconds: number;
  timestamp: string;
};

export type ServiceVisibility = {
  serviceName: string;
  status: 'UP' | 'DEGRADED' | 'DOWN';
  category: 'core' | 'orchestration' | 'ops';
  updatedAt: string;
};

export type SafeErrorRecord = {
  errorId: string;
  code: string;
  message: string;
  source: string;
  timestamp: string;
};

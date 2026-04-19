import { StatusBadge } from '@/components/ui/StatusBadge';

export type AlertItem = {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
};

export type AlertsPanelProps = {
  alerts: AlertItem[];
};

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  return (
    <section className="dashboard-panel">
      <h3>Alerts / Attention</h3>
      {alerts.length === 0 ? (
        <p className="panel-placeholder">No active alerts.</p>
      ) : (
        <ul className="panel-list">
          {alerts.map((alert) => (
            <li key={alert.id}>
              <div>
                <StatusBadge
                  label={alert.severity}
                  tone={alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'neutral'}
                />
                <span>{alert.message}</span>
              </div>
              <small>{new Date(alert.timestamp).toLocaleString()}</small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

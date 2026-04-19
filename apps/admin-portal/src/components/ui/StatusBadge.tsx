export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger';

export type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
};

export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  return <span className={`status-badge tone-${tone}`}>{label}</span>;
}

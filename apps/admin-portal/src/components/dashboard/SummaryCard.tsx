import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';

export type SummaryCardProps = {
  label: string;
  value: string | number;
  tone?: StatusTone;
};

export function SummaryCard({ label, value, tone = 'neutral' }: SummaryCardProps) {
  return (
    <article className="summary-card">
      <div className="summary-card-top">
        <h3>{label}</h3>
        <StatusBadge label={tone.toUpperCase()} tone={tone} />
      </div>
      <p className="summary-card-value">{value}</p>
    </article>
  );
}

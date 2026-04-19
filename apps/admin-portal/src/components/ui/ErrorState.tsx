import { EmptyState } from '@/components/ui/EmptyState';

export type ErrorStateProps = {
  title: string;
  description: string;
  onRetry?: () => void;
};

export function ErrorState({ title, description, onRetry }: ErrorStateProps) {
  return (
    <div className="error-state" role="alert" aria-live="assertive">
      <EmptyState title={title} description={description} />
      {onRetry ? (
        <button type="button" className="refresh-button" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

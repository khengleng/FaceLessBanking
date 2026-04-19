export function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" aria-label="dashboard loading">
      <div className="skeleton-header" />
      <div className="skeleton-grid">
        <div />
        <div />
        <div />
        <div />
        <div />
        <div />
      </div>
      <div className="skeleton-panel" />
      <div className="skeleton-panel" />
    </div>
  );
}

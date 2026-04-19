export type RecentActivityItem = {
  id: string;
  title: string;
  timestamp: string;
};

export type RecentActivityProps = {
  items: RecentActivityItem[];
};

export function RecentActivity({ items }: RecentActivityProps) {
  return (
    <section className="dashboard-panel">
      <h3>Recent Activity</h3>
      {items.length === 0 ? (
        <p className="panel-placeholder">No recent activity available.</p>
      ) : (
        <ul className="panel-list">
          {items.map((item) => (
            <li key={item.id}>
              <span>{item.title}</span>
              <small>{new Date(item.timestamp).toLocaleString()}</small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export type TablePlaceholderProps = {
  columns: string[];
};

export function TablePlaceholder({ columns }: TablePlaceholderProps) {
  return (
    <div className="table-placeholder" role="table" aria-label="table placeholder">
      <div className="table-head" role="row">
        {columns.map((column) => (
          <span key={column} role="columnheader">
            {column}
          </span>
        ))}
      </div>
      <div className="table-row-empty" role="row">
        <span role="cell">No records loaded yet.</span>
      </div>
    </div>
  );
}

import { Evidence } from "./Evidence";
export function Bars({
  values,
  onSelect,
}: {
  values: Record<string, number>;
  onSelect?: (key: string) => void;
}) {
  const entries = Object.entries(values),
    max = Math.max(1, ...Object.values(values));
  return entries.length ? (
    <div className="bars">
      {entries.map(([key, value]) => (
        <div key={key} className="bar-row">
          <button
            className="bar-label"
            onClick={() => onSelect?.(key)}
            disabled={!onSelect}
          >
            {key}
          </button>
          <div className="bar-track">
            <div style={{ width: `${(value / max) * 100}%` }} />
          </div>
          <strong>{value.toLocaleString()}</strong>
        </div>
      ))}
    </div>
  ) : (
    <p className="muted">No records in this view.</p>
  );
}
export function Trend({ values }: { values: Record<string, number> }) {
  const entries = Object.entries(values),
    max = Math.max(1, ...Object.values(values));
  return (
    <div
      className="trend"
      role="img"
      aria-label={`Monthly incidents: ${entries.map(([k, v]) => `${k}: ${v}`).join(", ")}`}
    >
      {entries.map(([key, value]) => (
        <div key={key} title={`${key}: ${value}`}>
          <span>{value}</span>
          <i style={{ height: `${Math.max(2, (value / max) * 130)}px` }} />
          <small>{key.includes(":") ? key : key.slice(2)}</small>
        </div>
      ))}
      {!entries.length && <p>No monthly data.</p>}
    </div>
  );
}
export function JsonView({ value }: { value: unknown }) {
  return <Evidence value={value} />;
}

import type { ReactNode } from "react";
export const humanize = (key: string) =>
  key.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
export function format(value: unknown): string {
  if (value === null || value === undefined) return "Not available";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number")
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return String(value);
}
export function Table({
  columns,
  rows,
  caption,
}: {
  columns: { key: string; label: string; render?: (row: any) => ReactNode }[];
  rows: any[];
  caption?: string;
}) {
  return (
    <div className="table-wrap">
      <table>
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || i}>
              {columns.map((c) => (
                <td key={c.key}>
                  {c.render ? c.render(row) : format(row[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="empty-inline">No matching records.</p>}
    </div>
  );
}
export function Evidence({ value, depth = 0 }: { value: any; depth?: number }) {
  if (value === null || value === undefined)
    return <span className="muted">Not available</span>;
  if (typeof value !== "object") return <span>{format(value)}</span>;
  if (Array.isArray(value)) {
    if (!value.length)
      return <p className="empty-inline">No records in this result.</p>;
    if (value.every((v) => v === null || typeof v !== "object"))
      return (
        <ul className="evidence-list">
          {value.map((v, i) => (
            <li key={i}>{format(v)}</li>
          ))}
        </ul>
      );
    const keys = Array.from(
      new Set(
        value
          .filter((v) => v && typeof v === "object")
          .flatMap((v) => Object.keys(v)),
      ),
    );
    return (
      <Table
        columns={keys.map((key) => ({
          key,
          label: humanize(key),
          render: (row) =>
            typeof row[key] === "object" && row[key] !== null ? (
              <details>
                <summary>
                  {Array.isArray(row[key])
                    ? `${row[key].length} items`
                    : "Inspect"}
                </summary>
                <Evidence value={row[key]} depth={depth + 1} />
              </details>
            ) : (
              format(row[key])
            ),
        }))}
        rows={value}
      />
    );
  }
  const scalars = Object.entries(value).filter(
      ([, v]) => v === null || typeof v !== "object",
    ),
    objects = Object.entries(value).filter(
      ([, v]) => v !== null && typeof v === "object",
    );
  return (
    <div className="evidence">
      <dl className="definition-grid">
        {scalars.map(([k, v]) => (
          <div key={k}>
            <dt>{humanize(k)}</dt>
            <dd>{format(v)}</dd>
          </div>
        ))}
      </dl>
      {objects.map(([k, v]) => (
        <details
          key={k}
          open={
            depth === 0 &&
            [
              "metrics",
              "points",
              "signals",
              "splits",
              "review_actions",
              "analysis",
            ].includes(k)
          }
        >
          <summary>
            {humanize(k)}
            {Array.isArray(v) ? ` · ${v.length}` : ""}
          </summary>
          <Evidence value={v} depth={depth + 1} />
        </details>
      ))}
    </div>
  );
}
export function QualitySummary({ quality: q }: { quality: any }) {
  return (
    <>
      <Table
        caption="Column mapping"
        columns={[
          { key: "source", label: "CSV column" },
          { key: "target", label: "Recognized field" },
        ]}
        rows={Object.entries(q.column_mappings || {}).map(
          ([source, target]) => ({ source, target }),
        )}
      />
      <div className="two-col">
        <section>
          <h3>Missing values</h3>
          <Table
            columns={[
              { key: "field", label: "Field" },
              { key: "count", label: "Missing rows" },
            ]}
            rows={Object.entries(q.missing_field_counts || {}).map(
              ([field, count]) => ({ field: humanize(field), count }),
            )}
          />
        </section>
        <section>
          <h3>Validation issues</h3>
          {q.errors?.length ? (
            <Table
              columns={[
                { key: "row", label: "CSV row" },
                { key: "error", label: "Issue" },
              ]}
              rows={q.errors}
            />
          ) : (
            <p className="success-note">No row validation errors.</p>
          )}
          <p className="muted">
            Structural completeness does not establish source authenticity.
          </p>
        </section>
      </div>
    </>
  );
}

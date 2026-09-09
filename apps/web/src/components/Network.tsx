import { useMemo, useState } from "react";
import { Table } from "./Evidence";
export default function Network({ network }: { network: any }) {
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState<any>(null),
    [relationship, setRelationship] = useState(""),
    [repeatOnly, setRepeatOnly] = useState(false),
    [component, setComponent] = useState("");
  const filtered = network.nodes.filter(
    (n: any) =>
      `${n.alias} ${n.id}`.toLowerCase().includes(search.toLowerCase()) &&
      (!repeatOnly || n.case_count > 1) &&
      (!component || network.components[Number(component) - 1]?.includes(n.id)),
  );
  const nodes = filtered.slice(0, 80);
  const position = useMemo(
    () =>
      new Map<string, { x: number; y: number }>(
        nodes.map((n: any, i: number) => [
          n.id,
          {
            x:
              350 +
              Math.cos((i / Math.max(nodes.length, 1)) * Math.PI * 2) * 245,
            y:
              230 +
              Math.sin((i / Math.max(nodes.length, 1)) * Math.PI * 2) * 160,
          },
        ]),
      ),
    [nodes],
  );
  const edges = network.edges.filter(
    (e: any) =>
      position.has(e.source) &&
      position.has(e.target) &&
      (!relationship || e.relationship_type === relationship),
  );
  const selectedEdges = network.edges.filter(
    (e: any) =>
      selected && (e.source === selected.id || e.target === selected.id),
  );
  return (
    <div>
      <div className="metric-grid">
        <div className="metric">
          <span>Declared entities</span>
          <strong>{network.nodes.length}</strong>
        </div>
        <div className="metric">
          <span>Relationships</span>
          <strong>{network.edges.length}</strong>
        </div>
        <div className="metric">
          <span>Connected components</span>
          <strong>{network.components.length}</strong>
        </div>
        <div className="metric">
          <span>Multiple-case entities</span>
          <strong>
            {network.nodes.filter((n: any) => n.case_count > 1).length}
          </strong>
        </div>
      </div>
      <div className="filter-bar">
        <label>
          Entity search
          <input
            aria-label="Search network"
            placeholder="Alias or identifier"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          Relationship
          <select
            aria-label="Relationship filter"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
          >
            <option value="">All relationships</option>
            {Array.from(
              new Set<string>(
                network.edges.map((e: any) => e.relationship_type),
              ),
            ).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Component
          <select
            value={component}
            onChange={(e) => setComponent(e.target.value)}
          >
            <option value="">All components</option>
            {network.components.map((c: any[], i: number) => (
              <option key={i} value={i + 1}>
                Component {i + 1} · {c.length} entities
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={repeatOnly}
            onChange={(e) => setRepeatOnly(e.target.checked)}
          />{" "}
          Multiple-case links only
        </label>
      </div>
      <div className="network-layout">
        <div>
          <svg
            className="network-graph"
            viewBox="0 0 700 460"
            aria-label="Declared relationship graph"
          >
            {edges.map((e: any, i: number) => (
              <line
                key={i}
                x1={position.get(e.source)!.x}
                y1={position.get(e.source)!.y}
                x2={position.get(e.target)!.x}
                y2={position.get(e.target)!.y}
                stroke={
                  selected &&
                  (e.source === selected.id || e.target === selected.id)
                    ? "#007d87"
                    : "#b9cbd8"
                }
                strokeWidth={
                  selected &&
                  (e.source === selected.id || e.target === selected.id)
                    ? 3
                    : 1.5
                }
              />
            ))}
            {nodes.map((n: any) => (
              <g
                key={n.id}
                transform={`translate(${position.get(n.id)!.x} ${position.get(n.id)!.y})`}
                role="button"
                tabIndex={0}
                aria-label={`Inspect ${n.alias}`}
                onClick={() => setSelected(n)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(n);
                  }
                }}
              >
                <circle
                  r={selected?.id === n.id ? 20 : 16}
                  fill={
                    selected?.id === n.id
                      ? "#0b526e"
                      : n.case_count > 1
                        ? "#007f89"
                        : "#557394"
                  }
                  stroke="white"
                  strokeWidth="3"
                />
                <text y="36" textAnchor="middle" fill="#263f54">
                  {n.alias}
                </text>
              </g>
            ))}
          </svg>
          {filtered.length > 80 && (
            <p className="notice">
              Showing the first 80 of {filtered.length} matching entities in the
              graph. Narrow the filters; the table retains all matches.
            </p>
          )}
          {!nodes.length && (
            <p className="empty-inline">No entities match these filters.</p>
          )}
        </div>
        <section className="entity-inspector">
          {selected ? (
            <>
              <span className="eyebrow">ENTITY INSPECTOR</span>
              <h2>{selected.alias}</h2>
              <p className="muted">
                {selected.entity_type || "Declared entity"}
              </p>
              <div className="actions">
                <span className="pill">
                  {selected.case_count} documented cases
                </span>
                <span className="pill">{selected.connections} connections</span>
              </div>
              <h3>Case history</h3>
              <Table
                columns={[
                  { key: "case_reference", label: "Case reference" },
                  {
                    key: "dates",
                    label: "Recorded dates",
                    render: (r) => r.dates?.join(", ") || "Not supplied",
                  },
                  {
                    key: "relationship_types",
                    label: "Declared links",
                    render: (r) => r.relationship_types?.join(", "),
                  },
                ]}
                rows={selected.case_history || []}
              />
              <h3>Relationships</h3>
              <Table
                columns={[
                  { key: "relationship_type", label: "Type" },
                  { key: "case_reference", label: "Case" },
                ]}
                rows={selectedEdges}
              />
            </>
          ) : (
            <div className="empty">
              <h3>Inspect an entity</h3>
              <p>
                Select a graph node or a table row to examine its declared
                connections and case history.
              </p>
            </div>
          )}
        </section>
      </div>
      <h3>{repeatOnly ? "Repeat-case activity" : "Entity directory"}</h3>
      <Table
        columns={[
          {
            key: "alias",
            label: "Entity",
            render: (n) => (
              <button className="text-button" onClick={() => setSelected(n)}>
                {n.alias}
              </button>
            ),
          },
          { key: "entity_type", label: "Declared type" },
          { key: "case_count", label: "Distinct cases" },
          { key: "connections", label: "Connections" },
        ]}
        rows={filtered}
      />
      <p className="notice">
        Multiple case links do not establish repeat offending.{" "}
        {network.limitation}
      </p>
    </div>
  );
}

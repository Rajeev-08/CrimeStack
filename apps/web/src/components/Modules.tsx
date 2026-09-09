import { useEffect, useState } from "react";
import { api, post, download, Dataset, ModuleRecord, User } from "../lib/api";
import { JsonView } from "./Charts";
import Network from "./Network";
import { Evidence, Table } from "./Evidence";
import { printSection } from "../lib/print";
const titles: Record<string, string> = {
  network: "Network Intelligence",
  model: "Risk Model Registry",
  context: "Socio-Economic Context",
  investigation: "Investigation Workspaces",
  task: "Operational Review Queue",
  notification: "Notification Centre",
  source: "Source Ingestion Operations",
  brief: "Governed Briefing Centre",
};
export default function Modules({
  kind,
  dataset,
  user,
}: {
  kind: string;
  dataset: Dataset;
  user: User;
}) {
  const [items, setItems] = useState<ModuleRecord[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [network, setNetwork] = useState<any>(null),
    [filter, setFilter] = useState(""),
    [query, setQuery] = useState(""),
    [result, setResult] = useState<any>(null),
    [users, setUsers] = useState<User[]>([]);
  const [minimumPriority, setMinimumPriority] = useState("low");
  const supervisor = ["supervisor", "administrator"].includes(user.role),
    analyst = user.role !== "viewer";
  async function load() {
    setBusy(true);
    try {
      const data = await api(`/api/records/${kind}?dataset_id=${dataset.id}`);
      setItems(data);
      if (kind === "network")
        setNetwork(await api(`/api/datasets/${dataset.id}/network`));
      if (kind === "task" && analyst) setUsers(await api("/api/users"));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    setResult(null);
    setError("");
    load();
  }, [kind, dataset.id]);
  async function run(fn: () => Promise<any>) {
    setError("");
    setBusy(true);
    try {
      const response = await fn();
      if (response?.valid !== undefined || response?.jobs || response?.dataset)
        setResult(response);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const create = (data: any) =>
    run(() => post(`/api/records/${kind}`, { dataset_id: dataset.id, data }));
  const action = (item: ModuleRecord, name: string, data: any = {}) =>
    run(() =>
      api(`/api/records/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ version: item.version, action: name, data }),
      }),
    );
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as any;
    if (kind === "investigation")
      data.evidence_refs = [`dataset:${dataset.id}`];
    if (kind === "task") {
      data.evidence_ref = `dataset:${dataset.id}`;
      data.sla_hours = Number(data.sla_hours);
    }
    if (kind === "source") {
      data.expected_schema = String(data.expected_schema)
        .split(",")
        .map((s: string) => s.trim());
      data.enabled = true;
      data.interval_hours = Number(data.interval_hours);
      data.max_retries = 2;
    }
    await create(data);
  }
  async function uploadJson(file: File) {
    setError("");
    try {
      await create(JSON.parse(await file.text()));
    } catch (e) {
      setError(String(e));
    }
  }
  const visible = items.filter(
    (i) =>
      (!filter || i.status === filter) &&
      JSON.stringify(i.data).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">DATASET-SCOPED WORKSPACE</span>
            <h2>{titles[kind]}</h2>
          </div>
          <button className="secondary" onClick={load}>
            Refresh
          </button>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {result && (
          <div className="notice">
            <JsonView value={result} />
          </div>
        )}
        {kind === "model" && (
          <>
            <p>
              Train calibrated district-category weekly models. A model must
              beat its chronological holdout baseline before a supervisor can
              activate it.
            </p>
            {analyst && (
              <button
                disabled={busy}
                onClick={() =>
                  run(() =>
                    post(`/api/datasets/${dataset.id}/models/train`, {}),
                  )
                }
              >
                Train aggregate model
              </button>
            )}
          </>
        )}
        {["network", "context"].includes(kind) && (
          <>
            <p>
              {kind === "network"
                ? "Import a separate relationship JSON with explicit authorization, stable aliases, case references and provenance. Incident records never create relationships."
                : "Import long-format indicator JSON with source, URL, licence, provenance, population, selected indicator and period. At least five matched districts are required for correlation."}
            </p>
            {analyst && (
              <label>
                Import authorized / synthetic JSON
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) =>
                    e.target.files?.[0] && uploadJson(e.target.files[0])
                  }
                />
              </label>
            )}
          </>
        )}
        {["investigation", "task", "source"].includes(kind) && analyst && (
          <details className="create-form">
            <summary>
              Create {kind === "task" ? "evidence-linked task" : kind}
            </summary>
            <form onSubmit={submit} className="form-grid">
              {(kind === "investigation"
                ? ["title", "summary", "scope", "limitations", "hypotheses"]
                : kind === "task"
                  ? ["title", "task_type"]
                  : [
                      "code",
                      "name",
                      "station_code",
                      "district_code",
                      "expected_schema",
                    ]
              ).map((field) => (
                <label key={field}>
                  {field.replaceAll("_", " ")}
                  <input
                    name={field}
                    required
                    defaultValue={
                      field === "expected_schema"
                        ? "occurred_at,category,station_code,district_code"
                        : ""
                    }
                  />
                </label>
              ))}
              {kind === "task" && (
                <>
                  <label>
                    Priority
                    <select name="priority">
                      <option>medium</option>
                      <option>low</option>
                      <option>high</option>
                      <option>critical</option>
                    </select>
                  </label>
                  <label>
                    SLA hours
                    <input
                      type="number"
                      name="sla_hours"
                      defaultValue="24"
                      min="1"
                      max="8760"
                    />
                  </label>
                </>
              )}
              {kind === "source" && (
                <label>
                  Schedule interval (hours)
                  <input
                    type="number"
                    name="interval_hours"
                    defaultValue="24"
                    min="1"
                  />
                </label>
              )}
              <p className="muted">
                Evidence scope: {dataset.name}. Source schedules request manual
                uploads; no remote URLs are fetched.
              </p>
              <button disabled={busy}>Create {kind}</button>
            </form>
          </details>
        )}
        {kind === "notification" && (
          <div className="actions">
            <label>
              Minimum priority
              <select
                value={minimumPriority}
                onChange={(e) => setMinimumPriority(e.target.value)}
              >
                <option>low</option>
                <option>medium</option>
                <option>high</option>
                <option>critical</option>
              </select>
            </label>
            {
              <button
                onClick={() =>
                  run(() =>
                    post("/api/records/subscription", {
                      dataset_id: dataset.id,
                      data: {
                        events: [
                          "assignment",
                          "escalation",
                          "sla",
                          "warning_change",
                          "brief_completion",
                        ],
                        minimum_priority: minimumPriority,
                      },
                    }),
                  )
                }
              >
                Subscribe to this dataset
              </button>
            }
            <button
              className="secondary"
              onClick={() => run(() => post("/api/notifications/read-all", {}))}
            >
              Mark all read
            </button>
          </div>
        )}
        {kind === "brief" && (
          <div className="actions">
            {analyst && (
              <button
                disabled={busy}
                onClick={() =>
                  run(() => post(`/api/datasets/${dataset.id}/briefs`, {}))
                }
              >
                Generate brief
              </button>
            )}
            {supervisor && (
              <>
                <button
                  className="secondary"
                  onClick={() =>
                    run(() =>
                      post("/api/records/brief_schedule", {
                        dataset_id: dataset.id,
                        data: {
                          title: "Daily dataset brief",
                          interval_hours: 24,
                          enabled: true,
                          scope: {},
                        },
                      }),
                    )
                  }
                >
                  Schedule daily brief
                </button>
                <button
                  className="secondary"
                  onClick={() => run(() => post("/api/scheduler/tick", {}))}
                >
                  Run due jobs
                </button>
              </>
            )}
            <label className="file-button">
              Verify downloaded JSON
              <input
                type="file"
                accept=".json"
                onChange={async (e) => {
                  try {
                    if (e.target.files?.[0]) {
                      const body = JSON.parse(await e.target.files[0].text());
                      await run(() => post("/api/briefs/verify", body));
                    }
                  } catch (err) {
                    setError(String(err));
                  }
                }}
              />
            </label>
          </div>
        )}
        {kind === "source" && supervisor && (
          <div className="actions">
            <button onClick={() => run(() => post("/api/scheduler/tick", {}))}>
              Run due schedules
            </button>
            <button
              className="secondary"
              onClick={() =>
                run(() => api(`/api/datasets/${dataset.id}/lineage`))
              }
            >
              Inspect dataset lineage
            </button>
            <button
              className="secondary"
              onClick={() =>
                run(async () => {
                  setResult(await api("/api/records/attempt"));
                  return {};
                })
              }
            >
              Attempt history
            </button>
          </div>
        )}
      </section>
      {network && kind === "network" && (
        <section className="panel">
          <Network network={network} />
        </section>
      )}
      <section className="panel">
        <div className="panel-heading">
          <h2>
            {items.length}{" "}
            {kind === "notification" ? "notifications" : "records"}
          </h2>
          <div className="actions">
            <input
              aria-label="Search records"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search records"
            />
            <select
              aria-label="Status filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              {Array.from(new Set(items.map((i) => i.status))).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        {busy && <p role="status">Loading…</p>}
        {!busy && !visible.length && (
          <div className="empty">
            <h3>No {kind} records yet</h3>
            <p>Records created for this dataset will appear here.</p>
          </div>
        )}
        {visible.map((item) => (
          <article className="record" id={`record-${item.id}`} key={item.id}>
            <div className="panel-heading">
              <h3>
                {item.data.title ||
                  item.data.name ||
                  item.data.message ||
                  `${kind} ${item.id.slice(0, 8)}`}
              </h3>
              <span
                className={`pill ${item.status === "rejected" ? "coral" : ""}`}
              >
                {item.status}
              </span>
            </div>
            <p className="muted">
              Version {item.version} ·{" "}
              {new Date(item.created_at).toLocaleString()}
            </p>
            {kind === "task" && (
              <p>
                Priority: {item.data.priority} · Due{" "}
                {new Date(item.data.due_at).toLocaleString()} ·{" "}
                {item.data.assignee
                  ? users.find((u) => u.id === item.data.assignee)?.email ||
                    item.data.assignee
                  : "Unassigned"}
                {new Date(item.data.due_at) < new Date() &&
                item.status !== "done"
                  ? " · SLA overdue"
                  : ""}
              </p>
            )}
            {kind === "model" && (
              <>
                <p>
                  {item.data.reason ||
                    `Brier score: ${item.data.brier_score?.toFixed(4)} · baseline: ${item.data.baseline_brier?.toFixed(4)}`}
                </p>
                {supervisor && item.status === "validated" && (
                  <button
                    onClick={() =>
                      run(() => post(`/api/models/${item.id}/activate`, {}))
                    }
                  >
                    Activate model
                  </button>
                )}
              </>
            )}
            {kind === "context" && item.data.analysis && (
              <>
                <p>
                  {item.data.analysis.points.length} matched districts ·
                  Spearman ρ:{" "}
                  {item.data.analysis.correlation?.rho.toFixed(3) ??
                    "Insufficient data"}
                </p>
                <Scatter points={item.data.analysis.points} />
              </>
            )}
            <div className="actions">
              {kind === "task" && analyst && (
                <>
                  <button onClick={() => action(item, "claim")}>Claim</button>
                  {["in_progress", "blocked", "done"].map((status) => (
                    <button
                      className="secondary"
                      key={status}
                      onClick={() => action(item, "status", { status })}
                    >
                      {status.replace("_", " ")}
                    </button>
                  ))}
                  {supervisor && (
                    <>
                      <button
                        className="secondary"
                        onClick={() => action(item, "escalate")}
                      >
                        Escalate
                      </button>
                      <select
                        aria-label="Reassign task"
                        value=""
                        onChange={(e) =>
                          e.target.value &&
                          action(item, "reassign", { assignee: e.target.value })
                        }
                      >
                        <option value="">Reassign…</option>
                        {users.map((u) => (
                          <option value={u.id} key={u.id}>
                            {u.email}
                          </option>
                        ))}
                      </select>
                      <label>
                        SLA override
                        <input
                          type="datetime-local"
                          onChange={(e) =>
                            e.target.value &&
                            action(item, "sla_override", {
                              due_at: new Date(e.target.value).toISOString(),
                            })
                          }
                        />
                      </label>
                    </>
                  )}
                </>
              )}
              {kind === "investigation" &&
                analyst &&
                item.status !== "approved" && (
                  <>
                    {["new", "draft", "rejected"].includes(item.status) &&
                      item.owner === user.id && (
                        <button onClick={() => action(item, "submit")}>
                          Submit for approval
                        </button>
                      )}
                    {supervisor && item.status === "submitted" && (
                      <>
                        <button onClick={() => action(item, "approve")}>
                          Approve and freeze
                        </button>
                        <button
                          className="secondary"
                          onClick={() => action(item, "reject")}
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </>
                )}
              {kind === "investigation" && (
                <button
                  className="secondary"
                  onClick={() =>
                    printSection(
                      document.getElementById(`record-${item.id}`),
                      `CrimeStack · ${item.data.title || kind}`,
                    )
                  }
                >
                  Print case brief
                </button>
              )}
              {kind === "notification" && item.status === "unread" && (
                <button onClick={() => action(item, "read")}>Mark read</button>
              )}
              {kind === "source" && supervisor && (
                <>
                  <button onClick={() => action(item, "toggle")}>
                    {item.data.enabled ? "Disable" : "Enable"}
                  </button>
                  <label className="file-button">
                    Execute CSV upload
                    <input
                      type="file"
                      accept=".csv"
                      disabled={!item.data.enabled}
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          const form = new FormData();
                          form.append("file", e.target.files[0]);
                          run(() =>
                            api(`/api/sources/${item.id}/execute`, {
                              method: "POST",
                              body: form,
                            }),
                          );
                        }
                      }}
                    />
                  </label>
                </>
              )}
              {kind === "brief" && (
                <>
                  <button
                    onClick={() =>
                      run(() => post("/api/briefs/verify", item.data))
                    }
                  >
                    Verify integrity
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      run(async () => {
                        download(
                          `crimestack-brief-${item.id}.json`,
                          await api(`/api/briefs/${item.id}/download`),
                        );
                        return {};
                      })
                    }
                  >
                    Download JSON
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      printSection(
                        document.getElementById(`record-${item.id}`),
                        `CrimeStack · ${item.data.title || kind}`,
                      )
                    }
                  >
                    Print / PDF
                  </button>
                </>
              )}
            </div>
            {["task", "investigation"].includes(kind) &&
              analyst &&
              item.status !== "approved" && (
                <form
                  className="actions"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    action(
                      item,
                      kind === "task" ? "comment" : String(f.get("action")),
                      { text: f.get("text") },
                    );
                    e.currentTarget.reset();
                  }}
                >
                  <input
                    name="text"
                    required
                    placeholder={
                      kind === "task"
                        ? "Add a comment"
                        : "Add investigation note"
                    }
                  />
                  {kind === "investigation" && (
                    <select name="action">
                      <option value="note">Note</option>
                      <option value="verification">Verification action</option>
                    </select>
                  )}
                  <button className="secondary">Add</button>
                </form>
              )}
            {kind === "model" && item.data.splits && (
              <div className="model-details">
                <h3>Chronological evaluation</h3>
                <Table
                  columns={[
                    { key: "name", label: "Split" },
                    { key: "samples", label: "Weekly cells" },
                    { key: "start", label: "From" },
                    { key: "end", label: "To" },
                  ]}
                  rows={item.data.splits}
                />
                <h3>
                  {item.status === "active"
                    ? "Active aggregate signals"
                    : "Candidate aggregate signals · activation required"}
                </h3>
                <Table
                  columns={[
                    { key: "district", label: "District" },
                    { key: "category", label: "Category" },
                    {
                      key: "probability",
                      label: "Calibrated probability",
                      render: (r) => `${(r.probability * 100).toFixed(1)}%`,
                    },
                    {
                      key: "factors",
                      label: "Additive explanation",
                      render: (r) => (
                        <details>
                          <summary>Inspect log-odds factors</summary>
                          <Evidence
                            value={{ intercept: r.intercept, ...r.factors }}
                          />
                        </details>
                      ),
                    },
                  ]}
                  rows={item.data.signals || []}
                />
                <p className="notice">{item.data.limitations}</p>
              </div>
            )}
            {kind === "investigation" && (
              <Evidence
                value={{
                  summary: item.data.summary,
                  scope: item.data.scope,
                  hypotheses: item.data.hypotheses,
                  limitations: item.data.limitations,
                  notes: item.data.notes,
                  verifications: item.data.verifications,
                  snapshot_sha256: item.data.snapshot_sha256,
                }}
              />
            )}
            {kind === "context" && item.data.analysis && (
              <>
                <Table
                  columns={[
                    { key: "district", label: "Matched district" },
                    { key: "incidents", label: "Incidents" },
                    { key: "population", label: "Population" },
                    { key: "rate_per_100000", label: "Rate per 100,000" },
                    { key: "indicator", label: "Selected indicator" },
                  ]}
                  rows={item.data.analysis.points}
                />
                <p className="notice">{item.data.analysis.limitation}</p>
              </>
            )}
            <details>
              <summary>Evidence and full details</summary>
              <JsonView value={item.data} />
            </details>
          </article>
        ))}
      </section>
    </>
  );
}
function Scatter({ points }: { points: any[] }) {
  const minX = Math.min(0, ...points.map((p) => p.indicator));
  const maxX = Math.max(1, ...points.map((p) => p.indicator)),
    maxY = Math.max(1, ...points.map((p) => p.rate_per_100000));
  return (
    <figure>
      <svg
        viewBox="0 0 600 280"
        className="scatter"
        aria-label="District indicator versus incident rate"
      >
        <path d="M50 20V230H570" fill="none" stroke="#688096" />
        {points.map((p) => (
          <circle
            key={p.district}
            cx={50 + ((p.indicator - minX) / (maxX - minX)) * 490}
            cy={230 - (p.rate_per_100000 / maxY) * 190}
            r="6"
            fill="#4dd9c0"
          >
            <title>
              {p.district}: indicator {p.indicator}, rate{" "}
              {p.rate_per_100000.toFixed(1)}
            </title>
          </circle>
        ))}
        <text x="230" y="265" fill="#c3d0dd">
          Selected indicator
        </text>
        <text x="55" y="17" fill="#c3d0dd">
          Incidents per 100,000
        </text>
      </svg>
      <figcaption>
        District association is non-causal. Compare periods before interpreting.
      </figcaption>
    </figure>
  );
}

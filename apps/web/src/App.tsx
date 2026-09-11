import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Shield,
  MessageSquare,
  Network as NetworkIcon,
  Brain,
  Video,
  BarChart3,
  FolderSearch,
  ClipboardCheck,
  ListTodo,
  Bell,
  Database,
  FileCheck,
  Lock,
  LogOut,
  Menu,
  Upload,
} from "lucide-react";
import { api, post, setToken, Dataset, User, ModuleRecord } from "./lib/api";
import { Bars, Trend, JsonView } from "./components/Charts";
import MapPanel from "./components/MapPanel";
import Copilot from "./components/Copilot";
import Surveillance from "./components/Surveillance";
import Modules from "./components/Modules";
import Registry from "./components/Registry";
import Patterns from "./components/Patterns";
import { Evidence, QualitySummary, Table } from "./components/Evidence";
const nav = [
  ["dashboard", "Command Centre", Activity],
  ["patterns", "Pattern Discovery", BarChart3],
  ["warnings", "Early Warnings", Shield],
  ["copilot", "Intelligence Copilot", MessageSquare],
  ["network", "Network Intelligence", NetworkIcon],
  ["model", "Risk Models", Brain],
  ["surveillance", "Surveillance Review", Video],
  ["context", "Socio-Economic Context", BarChart3],
  ["investigation", "Investigations", FolderSearch],
  ["task", "Operations", ListTodo],
  ["notification", "Notifications", Bell],
  ["brief", "Briefing Centre", FileCheck],
  ["quality", "Data Quality", ClipboardCheck],
  ["source", "Source Ingestion", Database],
  ["security", "Security and Audit", Lock],
  ["registry", "Data Registry", Database],
] as const;
export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [checking, setChecking] = useState(true),
    [page, setPage] = useState("dashboard"),
    [datasets, setDatasets] = useState<Dataset[]>([]),
    [active, setActive] = useState(""),
    [error, setError] = useState(""),
    [mobile, setMobile] = useState(false);
  async function refresh() {
    const data = await api<Dataset[]>("/api/datasets");
    setDatasets(data);
    setActive((id) => (data.some((d) => d.id === id) ? id : data[0]?.id || ""));
  }
  useEffect(() => {
    api<User>("/api/auth/me")
      .then(setUser)
      .catch(() => {})
      .finally(() => setChecking(false));
    const expire = () => {
      setUser(null);
      setError("Your session expired. Please sign in again.");
    };
    window.addEventListener("session-expired", expire);
    return () => window.removeEventListener("session-expired", expire);
  }, []);
  useEffect(() => {
    if (user) refresh().catch((e) => setError(String(e)));
  }, [user]);
  const selected = datasets.find((d) => d.id === active);
  if (checking)
    return (
      <div className="auth">
        <p role="status">Opening secure workspace…</p>
      </div>
    );
  if (!user)
    return (
      <Auth
        error={error}
        onLogin={(u) => {
          setUser(u);
          setError("");
        }}
      />
    );
  return (
    <div className={`app ${mobile ? "nav-open" : ""}`}>
      <a className="skip-link" href="#main-content">
        Skip to workspace
      </a>
      <aside>
        <a
          href="#dashboard"
          className="brand"
          onClick={() => setPage("dashboard")}
        >
          <span className="brand-icon">
            <Shield size={24} />
          </span>
          <span>
            CrimeStack<small>INTELLIGENCE WORKSPACE</small>
          </span>
        </a>
        <div className="workspace-label">
          ANALYST WORKSPACE <span>01</span>
        </div>
        <nav aria-label="Primary navigation">
          {nav
            .filter(
              ([id]) =>
                !(
                  ["source", "security"].includes(id) &&
                  !["supervisor", "administrator"].includes(user.role)
                ),
            )
            .map(([id, label, Icon]) => (
              <div className="nav-entry" key={id}>
                {(
                  {
                    dashboard: "ANALYSIS",
                    investigation: "CASEWORK",
                    quality: "DATA & GOVERNANCE",
                  } as Record<string, string>
                )[id] && (
                  <div className="nav-section">
                    {
                      (
                        {
                          dashboard: "ANALYSIS",
                          investigation: "CASEWORK",
                          quality: "DATA & GOVERNANCE",
                        } as Record<string, string>
                      )[id]
                    }
                  </div>
                )}
                <button
                  aria-current={page === id ? "page" : undefined}
                  key={id}
                  className={page === id ? "active" : ""}
                  onClick={() => {
                    setPage(id);
                    setMobile(false);
                  }}
                >
                  <Icon size={18} />
                  {label}
                </button>
              </div>
            ))}
        </nav>
        <div className="profile">
          <span className="avatar">{user.email[0].toUpperCase()}</span>
          <div>
            <strong>{user.email.split("@")[0]}</strong>
            <small>{user.role}</small>
          </div>
          <button
            aria-label="Sign out"
            onClick={() => {
              setToken("");
              setUser(null);
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <button
            className="mobile-toggle secondary"
            aria-label="Toggle navigation"
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            Workspace <span>/</span>{" "}
            <strong>{nav.find((n) => n[0] === page)?.[1]}</strong>
          </div>
          <span className="header-label">
            <Lock size={13} /> AUTHORIZED ACCESS
          </span>
        </header>
        <main id="main-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">CRIMESTACK / ANALYTICS & REVIEW</span>
              <h1>{nav.find((n) => n[0] === page)?.[1]}</h1>
              <p className="muted">
                {selected
                  ? `${selected.name} · ${selected.quality.accepted_rows.toLocaleString()} recorded incidents`
                  : "Choose a dataset to begin your analysis."}
              </p>
            </div>
            <div className="actions">
              <select
                aria-label="Active dataset"
                value={active}
                onChange={(e) => setActive(e.target.value)}
              >
                <option value="" disabled>
                  Select a dataset
                </option>
                {datasets.map((d) => (
                  <option value={d.id} key={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              {user.role !== "viewer" && (
                <button onClick={() => setPage("registry")}>
                  <Upload size={16} /> Import data
                </button>
              )}
            </div>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
              <button className="secondary" onClick={() => setError("")}>
                Dismiss
              </button>
            </p>
          )}
          {selected && (
            <div
              className={`provenance ${selected.provenance === "synthetic_demo" ? "synthetic" : ""}`}
            >
              <span className="pill">
                {selected.provenance.replaceAll("_", " ").toUpperCase()}
              </span>
              <span>
                {selected.provenance === "synthetic_demo"
                  ? "Fictional incidents and values. Geographic coordinates may refer to real locations."
                  : selected.provenance === "official_declared"
                    ? "Official publisher declared by importer; this claim is not authenticated."
                    : selected.provenance === "managed_source"
                      ? "Imported through a controlled source profile. Source authenticity is not guaranteed."
                      : "Structurally validated upload. Authenticity has not been independently verified."}
              </span>
              <small>{selected.publisher}</small>
            </div>
          )}
          {page === "registry" ? (
            <Registry
              datasets={datasets}
              user={user}
              onImported={async (id) => {
                await refresh();
                setActive(id);
                setPage("dashboard");
              }}
            />
          ) : page === "security" ? (
            <Security user={user} />
          ) : page === "surveillance" ? (
            <Surveillance />
          ) : !selected ? (
            <section className="panel empty">
              <Database size={40} />
              <h2>Start with a dataset</h2>
              <p>
                Import an incident CSV to calculate metrics and explore
                evidence. No operational statistics are preloaded.
              </p>
              {user.role !== "viewer" && (
                <button onClick={() => setPage("registry")}>
                  Open Data Registry
                </button>
              )}
            </section>
          ) : page === "dashboard" ? (
            <Dashboard key={active} dataset={selected} user={user} />
          ) : page === "warnings" ? (
            <Warnings key={active} dataset={selected} user={user} />
          ) : page === "copilot" ? (
            <Copilot key={active} datasetId={active} />
          ) : page === "patterns" ? (
            <Patterns dataset={selected} />
          ) : page === "quality" ? (
            <Quality dataset={selected} datasets={datasets} />
          ) : (
            <Modules
              key={`${page}:${active}`}
              kind={page}
              dataset={selected}
              user={user}
            />
          )}
          <footer>
            CrimeStack 0.2.0 · Reference application · Historical evidence
            requires human interpretation.
          </footer>
        </main>
      </div>
    </div>
  );
}
function Auth({
  onLogin,
  error,
}: {
  onLogin: (user: User) => void;
  error: string;
}) {
  const [bootstrap, setBootstrap] = useState(false),
    [message, setMessage] = useState(error),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/api/auth/status")
      .then((s) => setBootstrap(s.bootstrap_required))
      .catch((e) => setMessage(String(e)));
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const data = Object.fromEntries(new FormData(e.currentTarget).entries());
      const result = await post(
        `/api/auth/${bootstrap ? "bootstrap" : "login"}`,
        data,
      );
      setToken(result.access_token);
      onLogin(result.user);
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth">
      <section>
        <div className="brand">
          <span className="brand-icon">
            <Shield />
          </span>
          CrimeStack
        </div>
        <span className="eyebrow">INTELLIGENCE & ACCOUNTABILITY</span>
        <h1>{bootstrap ? "Establish your workspace" : "Welcome back"}</h1>
        <p className="muted">
          {bootstrap
            ? "Create the first administrator using the bootstrap secret from your environment configuration."
            : "Sign in to your authorized analysis workspace."}
        </p>
        <form onSubmit={submit}>
          <label>
            Email
            <input name="email" type="email" required autoComplete="username" />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              minLength={12}
              maxLength={128}
              required
              autoComplete={bootstrap ? "new-password" : "current-password"}
            />
          </label>
          {bootstrap && (
            <label>
              Bootstrap secret
              <input name="bootstrap_secret" type="password" required />
            </label>
          )}
          <button disabled={busy}>
            {busy
              ? "Opening workspace…"
              : bootstrap
                ? "Create administrator"
                : "Sign in"}
          </button>
        </form>
        {message && (
          <p role="alert" className="error">
            {message}
          </p>
        )}
        <p className="muted">
          Authorized access only. Actions are recorded in the audit trail.
        </p>
      </section>
    </div>
  );
}
function Dashboard({ dataset, user }: { dataset: Dataset; user: User }) {
  const [scope, setScope] = useState({
      district: "",
      category: "",
      start: "",
      end: "",
    }),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [views, setViews] = useState<ModuleRecord[]>([]),
    [viewTitle, setViewTitle] = useState("");
  async function load() {
    setBusy(true);
    setError("");
    try {
      setData(
        await api(
          `/api/datasets/${dataset.id}/analytics?${new URLSearchParams(scope)}`,
        ),
      );
      setViews(await api(`/api/records/view?dataset_id=${dataset.id}`));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, [scope]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await post("/api/records/view", {
        dataset_id: dataset.id,
        data: { title: viewTitle, scope },
      });
      setViewTitle("");
      await load();
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <>
      <section className="filter-bar">
        <label>
          District
          <select
            value={scope.district}
            onChange={(e) => setScope({ ...scope, district: e.target.value })}
          >
            <option value="">All districts</option>
            {Object.keys(dataset.quality.district_distribution)
              .filter(Boolean)
              .map((d) => (
                <option key={d}>{d}</option>
              ))}
          </select>
        </label>
        <label>
          Category
          <select
            value={scope.category}
            onChange={(e) => setScope({ ...scope, category: e.target.value })}
          >
            <option value="">All categories</option>
            {Object.keys(dataset.quality.category_distribution).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          From
          <input
            type="date"
            value={scope.start}
            onChange={(e) => setScope({ ...scope, start: e.target.value })}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={scope.end}
            onChange={(e) => setScope({ ...scope, end: e.target.value })}
          />
        </label>
        <button className="secondary" onClick={() => window.print()}>
          Print / PDF
        </button>
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
          <button onClick={load}>Retry</button>
        </p>
      )}
      {busy && (
        <div className="skeleton" role="status">
          Updating analytical view…
        </div>
      )}
      {data && (
        <>
          <div className="metric-grid">
            <Metric
              label="Total incidents"
              value={data.metrics.total}
              foot="In the active view"
            />
            <Metric
              label="High severity"
              value={data.metrics.high_severity}
              foot="High + critical records"
              tone="coral"
            />
            <Metric
              label="District coverage"
              value={data.metrics.district_coverage}
              foot="Distinct reported districts"
            />
            <Metric
              label="Data quality"
              value={`${dataset.quality.quality_score}%`}
              foot="Dataset structure, not authenticity"
              tone="teal"
            />
          </div>
          <div className="dashboard-grid">
            <MapPanel points={data.points} hotspots={data.hotspots} />
            <section className="panel">
              <span className="eyebrow">PATTERNS IN THE DATA</span>
              <h2>Category distribution</h2>
              <Bars
                values={data.metrics.categories}
                onSelect={(c) => setScope({ ...scope, category: c })}
              />
              <h3>Severity distribution</h3>
              <Bars values={data.metrics.severity} />
            </section>
          </div>
          <div className="two-col">
            <section className="panel">
              <span className="eyebrow">TEMPORAL OVERVIEW</span>
              <h2>Monthly incident trend</h2>
              <Trend values={data.metrics.monthly} />
            </section>
            <section className="panel">
              <span className="eyebrow">DISTRICT COMPARISON</span>
              <h2>District ranking</h2>
              <Bars
                values={data.metrics.districts}
                onSelect={(d) =>
                  d !== "Unspecified" && setScope({ ...scope, district: d })
                }
              />
            </section>
          </div>
        </>
      )}
      <section className="panel">
        <h2>Saved analytical views</h2>
        {user.role !== "viewer" && (
          <form onSubmit={save} className="actions">
            <input
              aria-label="View name"
              required
              value={viewTitle}
              onChange={(e) => setViewTitle(e.target.value)}
              placeholder="Name this view"
            />
            <button>Save current view</button>
          </form>
        )}
        <div className="actions">
          {views.map((v) => (
            <button
              className="secondary"
              key={v.id}
              onClick={() => setScope(v.data.scope)}
            >
              {v.data.title}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
function Metric({
  label,
  value,
  foot,
  tone = "",
}: {
  label: string;
  value: number | string;
  foot: string;
  tone?: string;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className={tone}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </strong>
      <small>{foot}</small>
    </div>
  );
}
function Warnings({ dataset, user }: { dataset: Dataset; user: User }) {
  const [threshold, setThreshold] = useState("standard"),
    [warnings, setWarnings] = useState<any[]>([]),
    [reviews, setReviews] = useState<ModuleRecord[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const loadVersion = useRef(0);
  async function load() {
    const version = ++loadVersion.current;
    setLoading(true);
    setError("");
    try {
      const d = await api(
        `/api/datasets/${dataset.id}/analytics?threshold=${threshold}`,
      );
      const nextReviews = await api(
        `/api/records/warning_review?dataset_id=${dataset.id}`,
      );
      if (version !== loadVersion.current) return;
      setWarnings(d.warnings);
      setReviews(nextReviews);
    } catch (e) {
      if (version === loadVersion.current) setError(String(e));
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }
  useEffect(() => {
    load();
    return () => {
      loadVersion.current += 1;
    };
  }, [threshold, dataset.id]);
  async function review(w: any, status: string, note: string) {
    try {
      let r = reviews.find((r) => r.data.warning_id === w.id);
      if (!r)
        r = await post("/api/records/warning_review", {
          dataset_id: dataset.id,
          data: { warning_id: w.id },
        });
      await api(`/api/records/${r!.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          version: r!.version,
          action: "review",
          data: { status, note },
        }),
      });
      await load();
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Historical count anomalies</h2>
        <select
          aria-label="Warning threshold"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
        >
          <option>sensitive</option>
          <option>standard</option>
          <option>conservative</option>
        </select>
      </div>
      <p className="muted">
        Latest observed week versus four preceding calendar weeks. Increases are
        review signals, not forecasts.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Calculating warnings…</p>
      ) : (
        !warnings.length && (
          <div className="empty">
            <h3>No warnings at this threshold</h3>
            <p>
              At least five observed weeks and a qualifying increase are
              required.
            </p>
          </div>
        )
      )}
      {!loading &&
        warnings.map((w) => (
          <article className="record" key={w.id} data-warning-id={w.id}>
            <h3>
              {w.name} <span className="pill amber">{w.dimension}</span>
            </h3>
            <p>
              {w.latest} incidents · baseline {w.baseline} ·{" "}
              {w.percentage_increase === null
                ? "zero baseline"
                : `${w.percentage_increase}% increase`}{" "}
              · {w.confidence} confidence
            </p>
            <p>
              Status:{" "}
              {reviews.find((r) => r.data.warning_id === w.id)?.status || "new"}
            </p>
            {user.role !== "viewer" && (
              <form
                className="actions"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  review(w, String(f.get("status")), String(f.get("note")));
                }}
              >
                <select name="status">
                  <option>investigating</option>
                  <option>resolved</option>
                  <option>dismissed</option>
                  <option>new</option>
                </select>
                <input name="note" placeholder="Review note" required />
                <button>Save review</button>
              </form>
            )}
            <details>
              <summary>Calculation, limitations and review history</summary>
              <JsonView
                value={{
                  ...w,
                  reviews: reviews.filter((r) => r.data.warning_id === w.id),
                }}
              />
            </details>
          </article>
        ))}
    </section>
  );
}
function Quality({
  dataset,
  datasets,
}: {
  dataset: Dataset;
  datasets: Dataset[];
}) {
  const [comparison, setComparison] = useState<any>(null),
    [error, setError] = useState("");
  return (
    <section className="panel">
      <h2>Stored quality assessment</h2>
      <p>
        Quality describes parsing and coverage. It does not verify source
        authenticity.
      </p>
      <label>
        Compare against baseline dataset
        <select
          defaultValue=""
          onChange={async (e) => {
            try {
              setComparison(
                await api(
                  `/api/datasets/${dataset.id}/compare/${e.target.value}`,
                ),
              );
            } catch (err) {
              setError(String(err));
            }
          }}
        >
          <option disabled value="">
            Choose baseline
          </option>
          {datasets
            .filter((d) => d.id !== dataset.id)
            .map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {comparison && (
        <>
          <h3>Drift comparison</h3>
          <JsonView value={comparison} />
        </>
      )}
      <QualitySummary quality={dataset.quality} />
      <Evidence
        value={{
          coverage: dataset.quality.coverage,
          date_window: dataset.quality.date_window,
          schema_fingerprint: dataset.quality.schema_fingerprint,
        }}
      />
    </section>
  );
}
function Security({ user }: { user: User }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function load() {
    try {
      setData(await api("/api/audit"));
    } catch (e) {
      setError(String(e));
    }
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Security and audit trail</h2>
        <button onClick={load}>Verify audit chain</button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <p className="notice">{notice}</p>}
      {data && (
        <>
          <p className={data.verification.valid ? "teal" : "coral"}>
            {data.verification.valid
              ? "Audit chain verified"
              : "Audit verification failed"}{" "}
            · {data.verification.entries} entries
          </p>
          <Table
            columns={[
              { key: "sequence", label: "Sequence" },
              { key: "at", label: "Timestamp" },
              { key: "action", label: "Action" },
              { key: "actor", label: "Actor" },
              { key: "target", label: "Evidence reference" },
            ]}
            rows={data.entries}
          />
          <details>
            <summary>Chain verification details</summary>
            <Evidence value={data.verification} />
          </details>
        </>
      )}
      {user.role === "administrator" && (
        <details>
          <summary>Create authorized user</summary>
          <form
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              try {
                await post(
                  "/api/users",
                  Object.fromEntries(new FormData(form)),
                );
                setNotice("User created.");
                form.reset();
                load();
              } catch (err) {
                setError(String(err));
              }
            }}
          >
            <label>
              Email
              <input type="email" name="email" required />
            </label>
            <label>
              Initial password
              <input type="password" minLength={12} name="password" required />
            </label>
            <label>
              Role
              <select name="role">
                <option>viewer</option>
                <option>analyst</option>
                <option>supervisor</option>
                <option>administrator</option>
              </select>
            </label>
            <button>Create user</button>
          </form>
        </details>
      )}
    </section>
  );
}

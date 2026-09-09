import { useEffect, useState } from "react";
import { api, Dataset } from "../lib/api";
import { Bars, Trend } from "./Charts";
import { Table } from "./Evidence";
export function PatternResult({ data }: { data: any }) {
  return (
    <>
      <div className="metric-grid">
        <div className="metric">
          <span>Recorded incidents</span>
          <strong>{data.total_incidents?.toLocaleString()}</strong>
          <small>Selected scope</small>
        </div>
        <div className="metric">
          <span>District/category segments</span>
          <strong>{data.segments?.length}</strong>
          <small>Historical records only</small>
        </div>
        <div className="metric">
          <span>ML weekly cells</span>
          <strong>{data.ml?.sample_count}</strong>
          <small>Complete interior weeks</small>
        </div>
        <div className="metric">
          <span>Unusual weekly cells</span>
          <strong>
            {data.ml?.status === "ready" ? data.ml.total_anomalies : "—"}
          </strong>
          <small>
            {data.ml?.status === "ready"
              ? "Isolation Forest"
              : "Insufficient observations"}
          </small>
        </div>
      </div>
      <div className="two-col">
        <section className="panel">
          <h2>Day-of-week distribution</h2>
          <Bars values={data.weekdays || {}} />
        </section>
        <section className="panel">
          <h2>Time-of-day distribution · UTC</h2>
          <Trend values={data.hourly || {}} />
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">EXPLAINABLE HISTORICAL PATTERNS</span>
            <h2>Unusual district-category weeks</h2>
          </div>
          <span className="pill">{data.ml?.algorithm}</span>
        </div>
        {data.ml?.status === "not_ready" ? (
          <p className="notice">{data.ml.reason}</p>
        ) : (
          <Table
            caption="Top 25 unusual weekly cells; scores are not probabilities"
            columns={[
              { key: "district", label: "District" },
              { key: "category", label: "Category" },
              { key: "week", label: "Week" },
              { key: "count", label: "Incidents" },
              { key: "anomaly_score", label: "Anomaly score" },
              { key: "count_above_median", label: "Count vs. median" },
            ]}
            rows={data.ml?.anomalies || []}
          />
        )}
      </section>
      <section className="panel">
        <h2>Recorded activity by district and category</h2>
        <Table
          columns={[
            { key: "district", label: "District" },
            { key: "category", label: "Category" },
            { key: "incidents", label: "Incidents" },
            { key: "high_severity", label: "High / critical" },
            { key: "active_weeks", label: "Active weeks" },
            { key: "first_seen", label: "First record" },
            { key: "last_seen", label: "Latest record" },
          ]}
          rows={data.segments || []}
        />
      </section>
      <section className="panel">
        <h2>Evidence review actions</h2>
        <Table
          columns={[
            { key: "scope", label: "Scope" },
            { key: "observation", label: "Observation" },
            { key: "action", label: "Next review step" },
          ]}
          rows={data.review_actions || []}
        />
        <p className="notice">{data.limitations}</p>
      </section>
    </>
  );
}
export default function Patterns({ dataset }: { dataset: Dataset }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [scope, setScope] = useState({
      district: "",
      category: "",
      start: "",
      end: "",
    });
  useEffect(() => {
    let current = true;
    setData(null);
    setError("");
    api(`/api/datasets/${dataset.id}/patterns?${new URLSearchParams(scope)}`)
      .then((value) => {
        if (current) setData(value);
      })
      .catch((e) => {
        if (current) setError(String(e));
      });
    return () => {
      current = false;
    };
  }, [dataset.id, scope]);
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
      </section>
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : data ? (
        <PatternResult data={data} />
      ) : (
        <div className="skeleton" role="status">
          Analyzing historical weekly patterns…
        </div>
      )}
    </>
  );
}

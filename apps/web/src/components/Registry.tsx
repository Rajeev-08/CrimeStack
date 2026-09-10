import { useRef, useState } from "react";
import { Upload, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { api, Dataset, User } from "../lib/api";
import { QualitySummary, Table } from "./Evidence";
export default function Registry({
  datasets,
  user,
  onImported,
}: {
  datasets: Dataset[];
  user: User;
  onImported: (id: string) => Promise<void> | void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [name, setName] = useState(""),
    [publisher, setPublisher] = useState(""),
    [provenance, setProvenance] = useState("uploaded_unverified"),
    [attempted, setAttempted] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null),
    publisherInput = useRef<HTMLInputElement>(null);
  async function inspect(f: File) {
    setFile(f);
    setPreview(null);
    setBusy(true);
    setAttempted(false);
    setError("");
    try {
      const form = new FormData();
      form.append("file", f);
      setPreview(
        await api("/api/datasets/preview", { method: "POST", body: form }),
      );
      setName(f.name.replace(/\.csv$/i, ""));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    setAttempted(true);
    setError("");
    if (!name.trim()) {
      nameInput.current?.focus();
      setError("Enter a dataset name before importing.");
      return;
    }
    if (!publisher.trim()) {
      publisherInput.current?.focus();
      setError(
        "Enter a publisher / source label before importing. For fictional examples, use “Fictional test generator”.",
      );
      return;
    }
    if (!file || !preview?.quality.accepted_rows) {
      setError("Choose a CSV with at least one accepted row.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("name", name.trim());
      form.append("publisher", publisher.trim());
      form.append("provenance", provenance);
      const result = await api("/api/datasets", { method: "POST", body: form });
      await onImported(result.id);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const q = preview?.quality;
  return (
    <>
      <section className="panel registry">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">DATA INTAKE</span>
            <h2>Import incident records</h2>
            <p className="muted">
              Validate the file, declare its source, then import.
            </p>
          </div>
          <span className="pill">CSV · up to 10 MB</span>
        </div>
        <ol className="import-steps">
          <li className={!file ? "current" : "complete"}>
            <span>1</span>Choose file
          </li>
          <li className={preview ? "complete" : file ? "current" : ""}>
            <span>2</span>Review validation
          </li>
          <li className={preview ? "current" : ""}>
            <span>3</span>Confirm source
          </li>
        </ol>
        {user.role !== "viewer" && (
          <label className="upload-zone">
            <Upload size={26} />
            <strong>{file ? file.name : "Choose incident CSV"}</strong>
            <span>
              Occurrence timestamp and category required · coordinates optional
            </span>
            <input
              aria-label="Incident CSV"
              type="file"
              accept=".csv"
              disabled={busy}
              onChange={(e) =>
                e.target.files?.[0] && inspect(e.target.files[0])
              }
            />
          </label>
        )}
        {busy && !preview && (
          <p role="status" className="skeleton">
            Validating records and coordinate coverage…
          </p>
        )}
        {preview && (
          <>
            <div className="metric-grid intake-metrics">
              {[
                "total_rows",
                "accepted_rows",
                "rejected_rows",
                "duplicate_rows",
                "map_ready_rows",
                "quality_score",
              ].map((k) => (
                <div className="metric" key={k}>
                  <span>{k.replaceAll("_", " ")}</span>
                  <strong>{q[k]?.toLocaleString()}</strong>
                </div>
              ))}
            </div>
            {q.map_ready_rows === 0 ? (
              <p className="notice">
                No usable coordinates. Import is supported, but this dataset
                will not produce map points.
              </p>
            ) : (
              <p className="success-note">
                <CheckCircle2 size={17} />
                {q.map_ready_rows.toLocaleString()} rows have usable
                coordinates.
              </p>
            )}
            <section className="source-form">
              <div>
                <span className="eyebrow">REQUIRED SOURCE DETAILS</span>
                <h3>Where did these records come from?</h3>
                <p className="muted">
                  These declarations remain visible throughout the workspace.
                </p>
              </div>
              <div className="form-grid">
                <label htmlFor="dataset-name">
                  Dataset name
                  <input
                    id="dataset-name"
                    ref={nameInput}
                    aria-label="Dataset name"
                    aria-invalid={attempted && !name.trim()}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={200}
                  />
                </label>
                <label htmlFor="publisher-source-label">
                  Publisher / source label
                  <input
                    id="publisher-source-label"
                    ref={publisherInput}
                    aria-label="Publisher / source label"
                    aria-invalid={attempted && !publisher.trim()}
                    value={publisher}
                    onChange={(e) => setPublisher(e.target.value)}
                    placeholder="e.g. Fictional test generator"
                    required
                    maxLength={200}
                  />
                </label>
                <label htmlFor="provenance">
                  Provenance
                  <select
                    id="provenance"
                    aria-label="Provenance"
                    value={provenance}
                    onChange={(e) => setProvenance(e.target.value)}
                  >
                    <option value="uploaded_unverified">
                      Uploaded — unverified
                    </option>
                    <option value="official_declared">
                      Official — importer declared
                    </option>
                    <option value="synthetic_demo">
                      Synthetic — fictional demonstration
                    </option>
                  </select>
                </label>
                <p className="muted">
                  Quality measures structure and completeness. It does not
                  establish authenticity.
                </p>
              </div>
            </section>
            <div className="import-confirmation">
              <div>
                <strong>
                  {!q.accepted_rows
                    ? "No valid rows to import"
                    : `${q.accepted_rows.toLocaleString()} accepted rows ready`}
                </strong>
                <p className="muted">
                  {!publisher.trim()
                    ? "Enter a publisher / source label to finish."
                    : !name.trim()
                      ? "Enter a dataset name to finish."
                      : "Review the provenance choice, then confirm."}
                </p>
              </div>
              <button disabled={busy || !q.accepted_rows} onClick={commit}>
                {busy ? "Importing…" : "Confirm import"}
              </button>
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <details>
              <summary>Mappings, missing fields and validation errors</summary>
              <QualitySummary quality={q} />
            </details>
            {preview.sample?.length > 0 && (
              <details>
                <summary>
                  Preview accepted records · first {preview.sample.length}
                </summary>
                <Table
                  columns={[
                    { key: "occurred_at", label: "Occurred at" },
                    { key: "category", label: "Category" },
                    { key: "district_code", label: "District" },
                    { key: "severity", label: "Severity" },
                    { key: "latitude", label: "Latitude" },
                    { key: "longitude", label: "Longitude" },
                  ]}
                  rows={preview.sample}
                />
              </details>
            )}
          </>
        )}
        {!preview && error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Registered datasets</h2>
          <span className="pill">{datasets.length} datasets</span>
        </div>
        <Table
          columns={[
            {
              key: "name",
              label: "Dataset",
              render: (d) => (
                <span className="dataset-name">
                  <FileSpreadsheet size={17} />
                  {d.name}
                </span>
              ),
            },
            { key: "publisher", label: "Declared source" },
            {
              key: "provenance",
              label: "Provenance",
              render: (d) => (
                <span
                  className={`pill ${d.provenance === "synthetic_demo" ? "violet" : ""}`}
                >
                  {d.provenance.replaceAll("_", " ")}
                </span>
              ),
            },
            {
              key: "rows",
              label: "Incidents",
              render: (d) => d.quality.accepted_rows.toLocaleString(),
            },
            {
              key: "map",
              label: "Map-ready",
              render: (d) => d.quality.map_ready_rows.toLocaleString(),
            },
          ]}
          rows={datasets}
        />
      </section>
    </>
  );
}

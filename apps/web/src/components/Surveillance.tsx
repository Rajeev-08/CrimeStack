import { useEffect, useRef, useState } from "react";
import { frameStats, groupEvents } from "../lib/surveillance";
import { download } from "../lib/api";
export default function Surveillance() {
  const [authorized, setAuthorized] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [url, setUrl] = useState(""),
    [report, setReport] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [progress, setProgress] = useState(0),
    [threshold, setThreshold] = useState(12);
  const video = useRef<HTMLVideoElement>(null),
    cancel = useRef(false);
  useEffect(() => {
    if (!file) return;
    const object = URL.createObjectURL(file);
    setUrl(object);
    return () => URL.revokeObjectURL(object);
  }, [file]);
  useEffect(
    () => () => {
      cancel.current = true;
    },
    [],
  );
  async function analyze() {
    if (!authorized || !video.current || !file) return;
    setError("");
    setBusy(true);
    cancel.current = false;
    const player = video.current;
    try {
      if (!Number.isFinite(player.duration) || player.duration > 3600)
        throw Error("Choose a loaded video up to 60 minutes long.");
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      let previous: Uint8ClampedArray | undefined;
      const samples = [];
      for (let t = 0; t < player.duration; t += 1) {
        if (cancel.current) throw Error("Analysis cancelled");
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(Error("Frame seeking timed out")),
            10000,
          );
          player.onseeked = () => {
            clearTimeout(timer);
            resolve();
          };
          player.currentTime = t === 0 ? 0.001 : t;
        });
        ctx.drawImage(player, 0, 0, 160, 90);
        const current = ctx.getImageData(0, 0, 160, 90).data;
        samples.push({ time: t, ...frameStats(current, previous) });
        previous = new Uint8ClampedArray(current);
        setProgress(Math.round((t / player.duration) * 100));
      }
      const checksum = Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
        ),
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      setReport({
        format: "crimestack-local-review/v1",
        filename: file.name,
        sha256: checksum,
        settings: { sample_seconds: 1, width: 160, height: 90, threshold },
        samples,
        events: groupEvents(samples, threshold),
        limitations:
          "Luminance differences can reflect lighting or camera movement. No identity, biometrics, intent, or enforcement inference. Browser decoding can vary.",
      });
      setProgress(100);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <span className="eyebrow">LOCAL-ONLY PROCESSING</span>
      <h2>Surveillance review</h2>
      <p>
        Footage and frames stay in this browser. Motion and lighting changes
        help navigate footage; they do not identify people or infer intent.
      </p>
      <label>
        <input
          type="checkbox"
          checked={authorized}
          onChange={(e) => setAuthorized(e.target.checked)}
        />{" "}
        I am authorized to review this footage.
      </label>
      <label>
        Local video
        <input
          type="file"
          accept="video/*"
          disabled={!authorized || busy}
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setReport(null);
          }}
        />
      </label>
      {url && <video ref={video} src={url} controls preload="metadata" />}
      <label>
        Motion threshold (0–255)
        <input
          type="number"
          min="1"
          max="255"
          value={threshold}
          disabled={busy}
          onChange={(e) => setThreshold(Number(e.target.value))}
        />
      </label>
      <div className="actions">
        <button disabled={!file || !authorized || busy} onClick={analyze}>
          Analyze local frames
        </button>
        {busy && (
          <button
            className="secondary"
            onClick={() => {
              cancel.current = true;
            }}
          >
            Cancel
          </button>
        )}
        {report && (
          <button
            className="secondary"
            onClick={() => download("local-surveillance-report.json", report)}
          >
            Export JSON report
          </button>
        )}
      </div>
      {busy && <progress max="100" value={progress} />}{" "}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {report && (
        <>
          <h3>{report.events.length} motion events</h3>
          {report.events.map((event: any, i: number) => (
            <button
              key={i}
              className="event"
              onClick={() => {
                if (video.current) video.current.currentTime = event.start;
              }}
            >
              {event.start}s–{event.end}s · peak change {event.peak.toFixed(1)}
            </button>
          ))}
          <p className="muted">{report.limitations}</p>
        </>
      )}
    </section>
  );
}

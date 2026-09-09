import { useEffect, useRef, useState } from "react";
import { api, post } from "../lib/api";
import { recognize, speak, speechAvailable } from "../lib/voice";
import { printSection } from "../lib/print";
import { Bars, Trend } from "./Charts";
import { Evidence, Table } from "./Evidence";
import { PatternResult } from "./Patterns";
import Network from "./Network";
export function CopilotResult({ message }: { message: any }) {
  const value = message.result,
    tool = message.tool || message.citations?.[0]?.tool;
  if (value === undefined) return null;
  if (typeof value === "number")
    return (
      <div className="answer-total">
        <strong>{value.toLocaleString()}</strong>
        <span>incidents in scope</span>
      </div>
    );
  if (["severity", "districts", "categories"].includes(tool))
    return <Bars values={value} />;
  if (tool === "trends") return <Trend values={value} />;
  if (tool === "patterns") return <PatternResult data={value} />;
  if (tool === "network") return <Network network={value} />;
  if (tool === "hotspots")
    return (
      <>
        <Table
          columns={[
            { key: "id", label: "Hotspot" },
            { key: "count", label: "Historical incidents" },
            {
              key: "cells",
              label: "Connected cells",
              render: (r) => r.cells.length,
            },
          ]}
          rows={value.groups || []}
        />
        <p className="notice">{value.limitation}</p>
      </>
    );
  if (tool === "warnings")
    return (
      <Table
        columns={[
          { key: "name", label: "Scope" },
          { key: "latest", label: "Latest week" },
          { key: "baseline", label: "Baseline" },
          { key: "anomaly_score", label: "Score" },
          { key: "confidence", label: "Confidence" },
        ]}
        rows={value}
      />
    );
  return <Evidence value={value} />;
}
export default function Copilot({ datasetId }: { datasetId: string }) {
  const [question, setQuestion] = useState(""),
    [messages, setMessages] = useState<any[]>([]),
    [capabilities, setCapabilities] = useState<any>(null),
    [previousTool, setPreviousTool] = useState<any>(null),
    [context, setContext] = useState<any>({}),
    [language, setLanguage] = useState<"en" | "kn">("en"),
    [read, setRead] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const recognition = useRef<any>(null),
    transcript = useRef<HTMLDivElement>(null),
    latest = useRef<HTMLDivElement>(null);
  useEffect(
    () => () => {
      recognition.current?.abort();
      if ("speechSynthesis" in window) speechSynthesis.cancel();
    },
    [],
  );
  useEffect(() => {
    api("/api/copilot/capabilities")
      .then(setCapabilities)
      .catch(() =>
        setCapabilities({
          mode: "Status unavailable",
          description:
            "Unable to check Copilot configuration. Try again after checking the backend.",
        }),
      );
  }, []);
  async function ask(text = question) {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await post(`/api/datasets/${datasetId}/copilot`, {
        question: text,
        language,
        context,
        previous_tool: previousTool,
      });
      setMessages((m) => [...m, { question: text, ...result }]);
      setContext(result.context);
      setPreviousTool(result.previous_tool || null);
      setQuestion("");
      if (read) speak(result.answer, language);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const suggestions =
    language === "en"
      ? [
          "Show total incidents",
          "Discover crime patterns",
          "Show repeat cases",
          "Show socio-economic correlation",
          "Show hotspots",
          "Show active models",
        ]
      : [
          "ಒಟ್ಟು ಎಷ್ಟು ಘಟನೆಗಳು",
          "ವಾರದ ದಿನ ಮಾದರಿಗಳ ಅನ್ವೇಷಣೆ",
          "ಪುನರಾವರ್ತಿತ ಪ್ರಕರಣ ಇತಿಹಾಸ",
          "ಸಾಮಾಜಿಕ ಸೂಚಕಗಳು",
          "ಹಾಟ್ ಸ್ಪಾಟ್",
          "ಮಾದರಿ",
        ];
  return (
    <section className="panel copilot">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">CONVERSATIONAL INTELLIGENCE</span>
          <h2>Ask the evidence</h2>
          <p className="muted">
            Explore recorded patterns, relationships and aggregate signals.
          </p>
        </div>
        <button
          className="secondary"
          disabled={!messages.length}
          onClick={() => {
            try {
              printSection(
                transcript.current,
                "CrimeStack · Cited conversation",
              );
            } catch (e) {
              setError(String(e));
            }
          }}
        >
          Export conversation PDF
        </button>
      </div>
      {capabilities && (
        <div className="notice" role="status">
          <strong>{capabilities.mode}</strong>
          <p>{capabilities.description}</p>
          <p>{capabilities.data_requirement}</p>
        </div>
      )}
      <div className="copilot-toolbar">
        <label>
          Language
          <select
            aria-label="Copilot language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as "en" | "kn")}
          >
            <option value="en">English</option>
            <option value="kn">ಕನ್ನಡ</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={read}
            onChange={(e) => setRead(e.target.checked)}
          />{" "}
          Read answers aloud
        </label>
        <button
          className="secondary"
          onClick={() => {
            setContext({});
            setPreviousTool(null);
          }}
        >
          Reset context
        </button>
      </div>
      <div className="scope-strip">
        <span>Conversation scope</span>
        {Object.entries(context).filter(([, v]) => v).length ? (
          Object.entries(context)
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <span className="pill" key={k}>
                {k}: {String(v)}
              </span>
            ))
        ) : (
          <span className="muted">Entire selected dataset</span>
        )}
      </div>
      <p className="muted no-print">
        Voice is optional. CrimeStack stores no audio; browser speech services
        may process audio remotely.{" "}
        {!speechAvailable() && "Recognition is unsupported in this browser."}{" "}
        PDF export opens the browser print dialog; choose Save as PDF.
      </p>
      {!messages.length && (
        <div className="conversation-welcome">
          <span className="eyebrow">START AN ANALYSIS</span>
          <h3>What would you like to investigate?</h3>
          <div className="suggestion-grid">
            {suggestions.map((text) => (
              <button
                key={text}
                className="suggestion"
                disabled={busy}
                onClick={() => ask(text)}
              >
                {text}
                <span aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
          <p className="muted">
            Examples: “Show theft in Bengaluru in January 2026”, followed by
            “What about Mysuru?”
          </p>
        </div>
      )}
      <div ref={transcript} className="transcript">
        {messages.map((message, i) => (
          <article className="message" key={i}>
            <div className="question-bubble">
              <span className="eyebrow">QUESTION {i + 1}</span>
              <h3>{message.question}</h3>
            </div>
            <div className="answer-body">
              <span className="pill">{message.mode}</span>
              <p className="answer-text">{message.answer}</p>
              <CopilotResult message={message} />
              <div className="citations">
                {message.citations.map((c: any, j: number) => (
                  <details key={j}>
                    <summary>
                      Evidence [{j + 1}] · {c.dataset_name}
                      {c.matched_rows !== null && c.matched_rows !== undefined
                        ? ` · ${c.matched_rows} records`
                        : ""}
                    </summary>
                    <Evidence value={c} />
                  </details>
                ))}
              </div>
              <p className="muted">{message.limitation}</p>
              {i === messages.length - 1 && (
                <div className="actions no-print">
                  {message.followups.map((f: string) => (
                    <button
                      key={f}
                      className="secondary"
                      disabled={busy}
                      onClick={() => ask(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
      <div ref={latest} />
      {busy && (
        <p role="status" className="skeleton">
          Calculating from the selected evidence…
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
      >
        <input
          aria-label="Question"
          placeholder={
            language === "en"
              ? "Ask a question about this dataset…"
              : "ಈ ದತ್ತಾಂಶದ ಬಗ್ಗೆ ಪ್ರಶ್ನೆಯನ್ನು ಕೇಳಿ…"
          }
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => {
            recognition.current?.abort();
            recognition.current = recognize(language, setQuestion, setError);
          }}
        >
          Voice
        </button>
        <button disabled={busy || !question.trim()}>
          {busy ? "Analyzing…" : "Ask Copilot"}
        </button>
      </form>
    </section>
  );
}

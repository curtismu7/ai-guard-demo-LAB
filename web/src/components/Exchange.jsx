import React, { useState } from "react";
import Json from "./JsonPane.jsx";
import { StandIn } from "./Badges.jsx";

function Pane({ title, sub, value, hot }) {
  return (
    <div className="pane">
      <h4>{title} <span className="sub">{sub}</span></h4>
      <Json value={value} label={`${title} JSON`} hot={hot} />
    </div>
  );
}

function StageRow({ stage }) {
  const [open, setOpen] = useState(false);
  const ex = stage.exchange;
  const findingCount = stage.evaluations?.length ?? 0;
  const verdict = stage.decision === "block" ? "BLOCK" : "ALLOW";
  const findingWord = findingCount === 1 ? "finding" : "findings";
  const summary = stage.sidecar.ok
    ? `${stage.sidecar.status ?? "answered"} · ${findingCount} ${findingWord} · ${stage.sidecar.latencyMs} ms`
    : `sidecar failed (${stage.sidecar.error})`;
  return (
    <div className={`exchange ${open ? "exchange--open" : ""}`} data-testid={`exchange-${stage.stage}`}>
      <button type="button" className="exchange-head" aria-expanded={open} data-testid={`exchange-toggle-${stage.stage}`} onClick={() => setOpen((v) => !v)}>
        <span className="exchange-caret" aria-hidden="true">{open ? "▾" : "▸"}</span>
        <span className="exchange-title">{stage.stage === "request" ? "Request direction" : "Response direction"}</span>
        <span className={`verdict v-${stage.decision}`}>{verdict}</span>
        <span className="sub exchange-summary">{summary}</span>
      </button>
      {open && (
        <div className="panes">
          <Pane title="Gateway sends" sub="POST /inspect" value={ex.request} hot={["text"]} />
          <Pane title="Sidecar answers" sub={ex.response.status ? `HTTP ${ex.response.status}` : "no answer"} value={ex.response.body ?? { error: ex.response.error }} hot={["category"]} />
        </div>
      )}
    </div>
  );
}

export default function Exchange({ run }) {
  const stages = run ? run.stages.filter((s) => s.exchange) : [];
  return (
    <section aria-labelledby="ex-h" className="card">
      <div className="card-head">
        <h2 id="ex-h">The /inspect exchange</h2>
        <span className="badges"><StandIn /></span>
      </div>
      {!stages.length ? <p className="empty">Run a scenario to see the exact request the gateway sends and the answer it gets back.</p> : stages.map((st) => <StageRow key={st.stage} stage={st} />)}
      {stages.length > 0 && <p className="fine">Shown with PII masked and secret-looking strings redacted, and long text cut at 300 characters. Hidden characters appear as <code>[U+200B]</code> style escapes. An empty findings list means allow. Expand a stage to read it as a Form or as the exact JSON (the buttons above it); neither scrolls.</p>}
    </section>
  );
}

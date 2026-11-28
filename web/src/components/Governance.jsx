import React from "react";
import { StandIn } from "./Badges.jsx";

// Three governance-side cards (2026-11-28), all driven by fields the server puts on every run entry:
//   Second layer  — the stand-in's own label scores beside the sidecar's verdict (deck claim, informs only).
//   Compliance    — the demo's own invented mapping of category+outcome to framework tags.
//   Behaviour     — per calling key, findings in the rolling window; escalated is an annotation, never a verdict.
const FRAMEWORK_LABEL = { "nist-ai-rmf": "NIST AI-RMF", "eu-ai-act": "EU AI Act" };
const pct = (s) => `${Math.round(s * 100)}%`;

export function SecondLayer({ run }) {
  const sl = run?.secondLayer;
  const top = sl?.standIn?.slice().sort((a, b) => b.score - a.score)[0];
  return (
    <section aria-labelledby="sl-h" className="card" data-testid="second-layer">
      <div className="card-head"><h2 id="sl-h">Second layer: two models, one text</h2><span className="badges"><StandIn /></span></div>
      {!sl ? <p className="empty">Run a scenario to see both models' scores.</p> : (
        <>
          <p className="fine">The deck claims a model-based second layer. Here the stand-in's own label scores sit beside the sidecar's verdict on the same text. They inform; neither decides here.</p>
          <dl className="kv">
            <dt>Sidecar verdict</dt><dd data-testid="sl-sidecar">{sl.sidecarOk ? "answered" : "unavailable"}</dd>
            {sl.standIn.map((s) => (
              <React.Fragment key={s.label}>
                <dt>Stand-in {s.label.toLowerCase()}</dt><dd data-testid={`sl-${s.label.toLowerCase()}`}>{pct(s.score)}</dd>
              </React.Fragment>
            ))}
            {top && <React.Fragment><dt>Top stand-in label</dt><dd>{top.label} at {pct(top.score)}</dd></React.Fragment>}
          </dl>
        </>
      )}
    </section>
  );
}

export function Compliance({ run }) {
  const c = run?.compliance;
  return (
    <section aria-labelledby="cm-h" className="card" data-testid="compliance">
      <div className="card-head"><h2 id="cm-h">Compliance mapping</h2></div>
      {!c ? <p className="empty">Run a scenario to see the framework tags.</p> : (
        <>
          <p className="fine">This demo's own mapping (lab-invented) from the run's categories and outcome to framework tags. It informs a governance conversation; it claims nothing about any product.</p>
          {Object.entries(c).map(([fw, tags]) => (
            <p key={fw} data-testid={`cm-${fw}`}>
              <strong>{FRAMEWORK_LABEL[fw] ?? fw}:</strong>{" "}
              {tags.length ? tags.map((t) => <span key={t} className="cm-tag">{t}</span>) : <span className="fine">none</span>}
            </p>
          ))}
        </>
      )}
    </section>
  );
}

export function Behaviour({ run }) {
  const b = run?.behaviour;
  return (
    <section aria-labelledby="bh-h" className="card" data-testid="behaviour">
      <div className="card-head"><h2 id="bh-h">Recent behaviour of the calling key</h2></div>
      {!run ? <p className="empty">Nothing run yet.</p> : !b ? (
        <p className="fine" data-testid="bh-none">This run had no calling agent key, so there is no behaviour to show. Pick a calling key with your text, or run the A2A scenario.</p>
      ) : (
        <>
          <p className="fine">A rolling count of findings across this key's recent runs, in memory, cleared by Reset. <strong>Informs only</strong> — it never changes a verdict.</p>
          <dl className="kv" data-testid="bh-level">
            <dt>Level</dt><dd><span className={`verdict ${b.level === "escalated" ? "v-block" : "v-allow"}`}>{b.level.toUpperCase()}</span></dd>
            <dt>Recent runs</dt><dd>{b.runs}</dd>
            <dt>Findings in window</dt><dd>{b.findings}</dd>
          </dl>
        </>
      )}
    </section>
  );
}

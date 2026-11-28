import React from "react";
import { StandIn } from "./Badges.jsx";
import { REASON_TEXT } from "../lib/model.js";

const MODES = [["none", "None"], ["error", "502 error"], ["timeout", "Timeout"], ["slow", "Slow"]];

// Fail Closed toggle, fault injector, and the side-by-side comparison from the outage scenario.
export default function Outage({ failClosed, onFailClosed, fault, onFault, compare, onCompare, busy, sanitizeMode = "off", onSanitizeMode }) {
  return (
    <section aria-labelledby="out-h" className="card">
      <div className="card-head">
        <h2 id="out-h">When the sidecar fails</h2>
      </div>
      <div className="row">
        <label className="switch">
          <input type="checkbox" role="switch" checked={failClosed} onChange={(e) => onFailClosed(e.target.checked)} />
          <span>Sidecar Fail Closed <strong data-testid="fc-state">{failClosed ? "ON" : "OFF"}</strong></span>
        </label>
      </div>
      <p className="fine">{failClosed ? "On: if the sidecar errors or times out, the gateway blocks. Safe, but an outage stops all traffic." : "Off: if the sidecar errors or times out, the gateway allows. Available, but unchecked, so attacks pass."}</p>
      <div className="row">
        <label htmlFor="sanitize-mode">Sanitize (the deck's fourth outcome):</label>{" "}
        <select id="sanitize-mode" data-testid="sanitize-mode" value={sanitizeMode} onChange={(e) => onSanitizeMode?.(e.target.value)}>
          <option value="off">Off — findings alert only</option>
          <option value="on">On — mask findings and forward</option>
        </select>
      </div>
      <p className="fine" data-testid="sanitize-state">{sanitizeMode === "on" ? "On: a request with findings that do not block is forwarded with the offending text masked, and the run records SANITIZE." : "Off: findings that do not block only raise an alert; the text is forwarded unchanged. Switch on to model the deck's fourth outcome."}</p>
      <fieldset className="fault">
        <legend>Fault injector (applies to the sidecar for every run)</legend>
        <div className="radios">
          {MODES.map(([v, l]) => (
            <label key={v}><input type="radio" name="fault" value={v} checked={fault.mode === v} onChange={() => onFault({ mode: v, delayMs: v === "slow" ? 250 : 0 })} /> {l}</label>
          ))}
        </div>
        <p className="fine" data-testid="fault-state">Sidecar is currently: <strong>{fault.mode === "none" ? "healthy" : fault.mode === "error" ? "returning 502" : fault.mode === "timeout" ? "never answering" : `answering after ${fault.delayMs} ms`}</strong>. {fault.mode !== "none" && "Remember to set it back to None."}</p>
      </fieldset>
      <div className="row">
        <button type="button" className="btn" onClick={onCompare} disabled={busy}>Show fail closed vs fail open</button>
      </div>
      {compare && (
        <div className="compare" data-testid="compare">
          {compare.map((r) => (
            <div key={r.label} className={`cmp cmp-${r.outcome}`} data-testid={`cmp-${r.policy.failClosed ? "closed" : "open"}`}>
              <h3>{r.policy.failClosed ? "Fail closed" : "Fail open"}</h3>
              <p className="verdict-big">{r.outcome === "block" ? "BLOCKED" : "ALLOWED"}</p>
              <p className="fine">{REASON_TEXT[r.reason]}</p>
              <p className="fine">{r.policy.failClosed ? "The user gets no answer, but nothing unchecked got through." : "The user gets an answer, including text the sidecar never inspected."}</p>
            </div>
          ))}
        </div>
      )}
      <p className="fine"><StandIn /> The sidecar here is a stand-in; the outage behaviour is as understood from the demo environment.</p>
    </section>
  );
}

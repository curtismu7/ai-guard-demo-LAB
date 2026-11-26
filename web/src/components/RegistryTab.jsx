// The Agent Registry tab: mock agent access keys with their scopes, grants and per-key guardrail.
// Everything is simulated; the naming and refusal wording follow the demo environment, UNVERIFIED.
import React, { useEffect, useState } from "react";
import * as api from "../lib/api.js";
import JsonPane from "./JsonPane.jsx";
import Inert from "./Inert.jsx";

const SCOPE_LABEL = { llm: "llm — models /llm/<provider>/v1", mcp: "mcp — tools /<app>/mcp", a2a: "a2a — agents /<app>/a2a" };
const BLANK_GUARDRAIL = { enabled: true, sidecarUrl: "http://localhost:8086/inspect", timeoutMs: 1000, blockAgreement: "off", failClosed: false };

function Chip({ on, children }) {
  return <span className={`chip ${on ? "chip--on" : ""}`}>{children}</span>;
}

function KeyForm({ initial, apps, onSubmit, onCancel, submitLabel }) {
  const [f, setF] = useState(initial);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((c) => ({ ...c, [k]: v }));
  const toggleScope = (s) => setF((c) => ({ ...c, scopes: c.scopes.includes(s) ? c.scopes.filter((x) => x !== s) : [...c.scopes, s] }));
  const toggleApp = (id) => setF((c) => ({ ...c, apps: c.apps.includes(id) ? c.apps.filter((x) => x !== id) : [...c.apps, id] }));
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    try { await onSubmit(f); } catch (ex) { setErr(ex.message); }
  };
  return (
    <form className="card" onSubmit={submit} data-testid="key-form">
      <div className="card-head"><h3>{submitLabel}</h3></div>
      {err && <p role="alert" className="error">{err}</p>}
      <label htmlFor="kf-name">Key name (permanent: rename = delete + recreate)</label>
      <input id="kf-name" value={f.name} onChange={(e) => set("name", e.target.value)} required pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]" />
      <label htmlFor="kf-custodian">Custodian (the human who answers for this agent)</label>
      <select id="kf-custodian" value={f.custodian} onChange={(e) => set("custodian", e.target.value)}>
        <option value="alice.example">alice.example</option>
        <option value="bob.example">bob.example</option>
      </select>
      <fieldset>
        <legend>Scopes (give only what the agent uses)</legend>
        {Object.entries(SCOPE_LABEL).map(([s, label]) => (
          <label key={s} className="pick"><input type="checkbox" checked={f.scopes.includes(s)} onChange={() => toggleScope(s)} /> {label}</label>
        ))}
      </fieldset>
      {f.scopes.includes("llm") && (
        <>
          <label htmlFor="kf-provider">LLM provider (one per key)</label>
          <input id="kf-provider" value={f.provider ?? ""} onChange={(e) => set("provider", e.target.value)} placeholder="openai" />
          <label htmlFor="kf-models">Allowed models (comma-separated)</label>
          <input id="kf-models" value={f.allowedModels.join(", ")} onChange={(e) => set("allowedModels", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="gpt-4o-mini" />
        </>
      )}
      {f.scopes.includes("mcp") && (
        <fieldset>
          <legend>Apps granted (selecting them IS the grant)</legend>
          {apps.map((a) => (
            <label key={a.id} className="pick"><input type="checkbox" checked={f.apps.includes(a.id)} onChange={() => toggleApp(a.id)} /> {a.name} ({a.tools.length} tools)</label>
          ))}
          <label htmlFor="kf-tools">Tool filter (empty = all published tools)</label>
          <input id="kf-tools" value={f.tools.join(", ")} onChange={(e) => set("tools", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="get_my_accounts, get_account_balance" />
        </fieldset>
      )}
      <fieldset>
        <legend>Runtime Protection (per-key guardrail)</legend>
        <label className="pick"><input type="checkbox" checked={f.guardrail.enabled} onChange={(e) => set("guardrail", { ...f.guardrail, enabled: e.target.checked })} /> External Guardrail detector on</label>
        <label htmlFor="kf-sidecar">ML Sidecar URL</label>
        <input id="kf-sidecar" value={f.guardrail.sidecarUrl} onChange={(e) => set("guardrail", { ...f.guardrail, sidecarUrl: e.target.value })} placeholder="http://localhost:8086/inspect" />
        <label htmlFor="kf-timeout">Sidecar timeout (ms, 0 = default 1000)</label>
        <input id="kf-timeout" type="number" min="0" max="60000" value={f.guardrail.timeoutMs} onChange={(e) => set("guardrail", { ...f.guardrail, timeoutMs: Number(e.target.value) || 0 })} />
        <label htmlFor="kf-agreement">Block Agreement</label>
        <select id="kf-agreement" value={f.guardrail.blockAgreement} onChange={(e) => set("guardrail", { ...f.guardrail, blockAgreement: e.target.value })}>
          <option value="off">Off — ML blocks alone</option>
          <option value="unit">Unit — a built-in must agree</option>
          <option value="inspection">Inspection — a built-in must agree</option>
        </select>
        <label className="pick"><input type="checkbox" checked={f.guardrail.failClosed} onChange={(e) => set("guardrail", { ...f.guardrail, failClosed: e.target.checked })} /> Sidecar Fail Closed</label>
      </fieldset>
      <div className="row">
        <button type="submit" className="btn primary">{submitLabel}</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function RegistryTab({ apps, onAppsChanged, onRan, resetKey }) {
  const [keys, setKeys] = useState([]);
  const [form, setForm] = useState(null); // null | {mode:'add'} | {mode:'edit', id}
  const [grant, setGrant] = useState(null); // { key, grant }
  const [call, setCall] = useState({ keyName: "", appName: "", tool: "" });
  const [callResult, setCallResult] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const refresh = () => api.getKeys().then((r) => { setKeys(r.keys); }).catch((e) => setError(e.message));
  useEffect(() => { refresh(); }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveKey = async (f) => {
    const body = {
      name: f.name, custodian: f.custodian, scopes: f.scopes,
      provider: f.scopes.includes("llm") ? (f.provider || null) : null,
      allowedModels: f.scopes.includes("llm") ? f.allowedModels : [],
      rpm: 60, tpm: 10000, expiresAt: null, apps: f.apps, tools: f.tools, guardrail: f.guardrail,
    };
    if (form.mode === "edit") await api.updateKey(form.id, body);
    else await api.addKey(body);
    setForm(null); setStatus("Key saved. In the product, new changes take about four minutes to reach the gateway."); refresh(); if (onAppsChanged) onAppsChanged();
  };

  const showGrant = async (k) => {
    const g = await api.getKeyGrant(k.id);
    setGrant({ key: k, grant: g });
  };

  const tryCall = async (e) => {
    e.preventDefault(); setError(""); setCallResult(null);
    try { setCallResult(await api.tryCall(call)); onRan(); }
    catch (ex) { setCallResult({ refused: true, message: ex.message, status: ex.status }); onRan(); }
  };

  const keyApps = (k) => apps.filter((a) => k.apps.includes(a.id));

  return (
    <div data-testid="registry-tab">
      <p className="lede">The Agent Registry: one access key <em>is</em> the agent&apos;s whole identity — scopes, allowed apps (the grant), rate caps and its own guardrail all hang off it. The agent holds a virtual key only; the real upstream credential, if any, stays server-side.</p>
      <p role="note" className="fine">Simulated. Key shape, scopes, grant semantics and refusal wording are as understood from the demo environment, UNVERIFIED against product documentation. Keys are mock-issued and labelled <code>vk-mock-…</code>; they are never real credentials.</p>
      {error && <p role="alert" className="error">{error}</p>}
      <p className="sr-only" role="status" aria-live="polite">{status}</p>

      <div className="row" style={{ marginBottom: "0.75rem" }}>
        <button type="button" className="btn primary" data-testid="add-key" onClick={() => setForm({ mode: "add", initial: { name: "", custodian: "alice.example", scopes: ["mcp"], provider: null, allowedModels: [], apps: [], tools: [], guardrail: BLANK_GUARDRAIL } })}>Add Agent (key)</button>
      </div>

      {form && <KeyForm initial={form.initial} apps={apps} submitLabel={form.mode === "edit" ? "Save changes" : "Create key"} onCancel={() => setForm(null)} onSubmit={saveKey} />}

      <section className="card" aria-labelledby="keys-h">
        <div className="card-head"><h2 id="keys-h">Keys ({keys.length})</h2></div>
        <table className="registry-table" data-testid="keys-table">
          <thead><tr><th>Name</th><th>Custodian</th><th>Scopes</th><th>Apps granted</th><th>Guardrail</th><th>Key</th><th></th></tr></thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} data-testid={`key-row-${k.name}`}>
                <td><Inert text={k.name} />{k.revoked && <Chip on={false}>revoked</Chip>}{k.expired && <Chip on={false}>expired</Chip>}</td>
                <td>{k.custodian}</td>
                <td>{k.scopes.map((s) => <Chip key={s} on>{s}</Chip>)}{k.provider && <span className="fine"> {k.provider}</span>}</td>
                <td>{keyApps(k).length ? keyApps(k).map((a) => a.name).join(", ") : <span className="fine">none</span>}{k.tools.length ? <span className="fine"> · tools: {k.tools.join(", ")}</span> : null}</td>
                <td>{k.guardrail.enabled ? <Chip on>sidecar {k.guardrail.blockAgreement}</Chip> : <Chip on={false}>off</Chip>}</td>
                <td><code className="fine">{k.keyValue ? `${k.keyValue.slice(0, 12)}…` : "—"}</code></td>
                <td className="row-actions">
                  <button type="button" className="btn" onClick={() => setForm({ mode: "edit", id: k.id, initial: { ...k, guardrail: { ...k.guardrail } } })}>Edit</button>
                  <button type="button" className="btn" onClick={() => showGrant(k)}>Grant</button>
                  <button type="button" className="btn" onClick={async () => { await api.revokeKey(k.id); refresh(); }} disabled={k.revoked}>Revoke</button>
                  <button type="button" className="btn" onClick={async () => { await api.deleteKey(k.id); refresh(); }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {grant && (
        <section className="card" data-testid="grant-card">
          <div className="card-head"><h3>What Privilege did for <Inert text={grant.key.name} /></h3></div>
          <JsonPane value={grant.grant} hot={["key", "apps", "issuedTo", "tools"]} />
          <div className="row"><button type="button" className="btn" onClick={() => setGrant(null)}>Close</button></div>
        </section>
      )}

      <section className="card" aria-labelledby="call-h" data-testid="call-card">
        <div className="card-head"><h2 id="call-h">Try a call as a key</h2></div>
        <p>Pick a key, an app and a tool. The registry decides access (identity → grant → tool filter), then the key&apos;s own guardrail screens the call text. Use a prompt-injection phrase to see the guardrail block even an allowed call.</p>
        <form onSubmit={tryCall} className="call-form">
          <label htmlFor="call-key">Key</label>
          <select id="call-key" value={call.keyName} onChange={(e) => setCall({ ...call, keyName: e.target.value })} required>
            <option value="">Choose…</option>
            {keys.filter((k) => !k.revoked).map((k) => <option key={k.id} value={k.name}>{k.name}</option>)}
          </select>
          <label htmlFor="call-app">App</label>
          <select id="call-app" value={call.appName} onChange={(e) => setCall({ ...call, appName: e.target.value, tool: "" })} required>
            <option value="">Choose…</option>
            {apps.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
          </select>
          <label htmlFor="call-tool">Tool</label>
          <select id="call-tool" value={call.tool} onChange={(e) => setCall({ ...call, tool: e.target.value })} required>
            <option value="">Choose…</option>
            {(apps.find((a) => a.name === call.appName)?.tools ?? []).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="row"><button type="submit" className="btn primary" disabled={!call.keyName || !call.appName || !call.tool}>Send the call</button></div>
        </form>
        {callResult && (
          <div data-testid="call-result">
            {callResult.refused
              ? <p className="recorded">recorded decision <strong className="verdict v-block">REFUSED</strong> — {callResult.message}</p>
              : (
                <>
                  <p className="recorded">Access <strong className="verdict v-allow">ALLOWED</strong> · guardrail decision <strong className={`verdict v-${callResult.run.outcome === "block" ? "block" : "allow"}`}>{callResult.run.outcome === "block" ? `BLOCK at ${callResult.run.blockedAt}` : "ALLOW"}</strong></p>
                  <JsonPane value={{ access: callResult.access, guardrail: callResult.guardrail, decision: callResult.run }} hot={["outcome", "reason", "blockedAt"]} />
                </>
              )}
          </div>
        )}
      </section>
    </div>
  );
}

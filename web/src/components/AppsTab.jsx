// The Agentic Apps tab: mock MCP "doors" the gateway routes to at /<app>/mcp.
// Everything is simulated; the route derivation follows the demo environment and is not checked against product documentation.
import React, { useState } from "react";
import * as api from "../lib/api.js";
import Inert from "./Inert.jsx";

function AppForm({ initial, onSubmit, onCancel, submitLabel }) {
  const [f, setF] = useState(initial);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((c) => ({ ...c, [k]: v }));
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    try { await onSubmit({ ...f, tools: f.toolsText.split(",").map((s) => s.trim()).filter(Boolean) }); } catch (ex) { setErr(ex.message); }
  };
  return (
    <form className="card" onSubmit={submit} data-testid="app-form">
      <div className="card-head"><h3>{submitLabel}</h3></div>
      {err && <p role="alert" className="error">{err}</p>}
      <label htmlFor="af-name">Application name (the client route is derived from it: /&lt;name&gt;/mcp)</label>
      <input id="af-name" value={f.name} onChange={(e) => set("name", e.target.value)} required pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]" />
      <label htmlFor="af-url">MCP Server URL (backend service)</label>
      <input id="af-url" value={f.mcpUrl} onChange={(e) => set("mcpUrl", e.target.value)} placeholder="http://banking.invalid/mcp" required />
      <label htmlFor="af-tools">Published tools (comma-separated)</label>
      <input id="af-tools" value={f.toolsText} onChange={(e) => set("toolsText", e.target.value)} placeholder="get_my_accounts, get_account_balance" required />
      <label className="pick"><input type="checkbox" checked={f.published} onChange={(e) => set("published", e.target.checked)} /> Published (visible to grants)</label>
      <div className="row">
        <button type="submit" className="btn primary">{submitLabel}</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function AppsTab({ apps, onAppsChanged, resetKey }) {
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const save = async (body) => {
    if (form.mode === "edit") await api.updateApp(form.id, body);
    else await api.addApp(body);
    setForm(null); setStatus("Application saved. In the product, a brand-new route is picked up immediately; policy edits take about four minutes.");
    onAppsChanged();
  };
  return (
    <div data-testid="apps-tab">
      <p className="lede">Agentic Apps are the gateway&apos;s doors: one application per backend MCP server, with the client route derived from the application name — <code>/&lt;application-name&gt;/mcp</code>. An app created outside the proper wizard gets no working route; publishing alone configures nothing that runs.</p>
      <p role="note" className="fine">Simulated. Route derivation and app semantics are as understood from the demo environment, not checked against product documentation. URLs must use .invalid or .example hosts; nothing here contacts any backend.</p>
      {error && <p role="alert" className="error">{error}</p>}
      <p className="sr-only" role="status" aria-live="polite">{status}</p>

      <div className="row" style={{ marginBottom: "0.75rem" }}>
        <button type="button" className="btn primary" data-testid="add-app" onClick={() => setForm({ mode: "add", initial: { name: "", mcpUrl: "", toolsText: "", published: true } })}>Add Application (MCP Server)</button>
      </div>

      {form && <AppForm initial={form.initial} submitLabel={form.mode === "edit" ? "Save changes" : "Create application"} onCancel={() => setForm(null)} onSubmit={save} />}

      <div className="grid two">
        {apps.map((a) => (
          <section className="card" key={a.id} data-testid={`app-card-${a.name}`}>
            <div className="card-head"><h2><Inert text={a.name} /> {!a.published && <span className="fine">(unpublished)</span>}</h2></div>
            <dl className="kv">
              <dt>Client route</dt><dd><code data-testid={`app-route-${a.name}`}>/{a.name}/mcp</code></dd>
              <dt>Backend</dt><dd><code>{a.mcpUrl}</code></dd>
              <dt>Published tools</dt><dd>{a.tools.join(", ")}</dd>
            </dl>
            <div className="row">
              <button type="button" className="btn" onClick={() => setForm({ mode: "edit", id: a.id, initial: { name: a.name, mcpUrl: a.mcpUrl, toolsText: a.tools.join(", "), published: a.published } })}>Edit</button>
              <button type="button" className="btn" onClick={async () => { await api.deleteApp(a.id); onAppsChanged(); }}>Delete</button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

// The Agent Registry: mock agent access keys (Privilege-style, as understood from the demo environment,
// not checked against product documentation) and the Agentic Apps (MCP doors) they may be granted to.
// Everything here is mock data, in-process, per workspace, reset by the demo Reset. No real tenant.
// Names are demo-invented; they follow no tenant and carry no credential.
import { randomUUID } from 'node:crypto';

export const SCOPES = ['llm', 'mcp', 'a2a'];
export const BLOCK_AGREEMENTS = ['off', 'unit', 'inspection'];
export const CUSTODIANS = ['alice.example', 'bob.example'];

const MAX_KEYS = 20;
const MAX_APPS = 12;
const NAME_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const MAX_MODELS = 20;
const RATE_LIMIT = { rpm: [1, 600], tpm: [100, 200000] };
const FUTURE_MS = 24 * 60 * 60 * 1000; // expiry must be at least a day out

export class RegistryInvalid extends Error {}

const invalid = (m) => { throw new RegistryInvalid(m); };
const str = (v, what, max = 200) => {
  if (typeof v !== 'string' || !v.trim()) invalid(`${what} must be a non-empty string`);
  if (v.length > max) invalid(`${what} must be at most ${max} characters`);
  return v;
};
const optStr = (v, what, max) => (v === undefined || v === null ? '' : str(v, what, max));
const oneOf = (v, list, what) => (list.includes(v) ? v : invalid(`${what} must be one of ${list.join(', ')}`));
const bool = (v, what, dflt) => {
  if (v === undefined) return dflt;
  if (typeof v !== 'boolean') invalid(`${what} must be a boolean`);
  return v;
};

export const DEFAULT_APPS = [
  { id: 'app-airline', name: 'airline', type: 'mcp', mcpUrl: 'http://airline.invalid/mcp', tools: ['search_flights', 'book_flight', 'get_reservation'], published: true },
  { id: 'app-banking', name: 'banking', type: 'mcp', mcpUrl: 'http://banking.invalid/mcp', tools: ['get_my_accounts', 'get_account_balance', 'list_transactions'], published: true },
  { id: 'app-travel', name: 'travel', type: 'mcp', mcpUrl: 'http://travel.invalid/mcp', tools: ['search_flights', 'book_flight'], published: true },
  { id: 'app-notes', name: 'notes', type: 'mcp', mcpUrl: 'http://notes.invalid/mcp', tools: ['search_notes', 'create_note'], published: false },
];

export const DEFAULT_KEYS = [
  {
    id: 'key-payments-agent', name: 'payments-agent', custodian: 'alice.example', provider: null, scopes: ['mcp'],
    allowedModels: [], rpm: 60, tpm: 10000, expiresAt: null, revoked: false,
    apps: ['app-airline', 'app-banking'], tools: ['search_flights', 'get_reservation', 'get_my_accounts'],
    guardrail: { enabled: true, sidecarUrl: 'http://localhost:8086/inspect', timeoutMs: 1000, blockAgreement: 'off', failClosed: false },
  },
  {
    id: 'key-research-agent', name: 'research-agent', custodian: 'bob.example', provider: 'openai', scopes: ['llm'],
    allowedModels: ['gpt-4o-mini'], rpm: 30, tpm: 5000, expiresAt: null, revoked: false,
    apps: [], tools: [],
    guardrail: { enabled: true, sidecarUrl: 'http://localhost:8086/inspect', timeoutMs: 1000, blockAgreement: 'inspection', failClosed: false },
  },
  {
    id: 'key-orchestrator', name: 'orchestrator', custodian: 'alice.example', provider: null, scopes: ['mcp', 'a2a'],
    allowedModels: [], rpm: 120, tpm: 20000, expiresAt: null, revoked: false,
    apps: ['app-airline', 'app-banking', 'app-travel'], tools: [],
    guardrail: { enabled: false, sidecarUrl: '', timeoutMs: 1000, blockAgreement: 'off', failClosed: false },
  },
];

// Guardrail settings per key: the five fields the console's Runtime Protection step edits.
export function validateGuardrail(g, what = 'guardrail') {
  if (!g || typeof g !== 'object' || Array.isArray(g)) invalid(`${what} must be an object`);
  const keys = Object.keys(g).sort().join();
  if (keys !== 'blockAgreement,enabled,failClosed,sidecarUrl,timeoutMs') invalid(`${what} must have exactly: enabled, sidecarUrl, timeoutMs, blockAgreement, failClosed`);
  const enabled = bool(g.enabled, `${what}.enabled`);
  const sidecarUrl = optStr(g.sidecarUrl, `${what}.sidecarUrl`, 300);
  if (enabled && !sidecarUrl) invalid('sidecarUrl is required when the external guardrail detector is enabled');
  if (sidecarUrl && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/\S*)?$/.test(sidecarUrl) && !sidecarUrl.endsWith('/inspect')) {
    // keep it lenient: any http URL ending in /inspect, or a loopback one. This is a mock.
    invalid(`${what}.sidecarUrl must be an http URL ending in /inspect`);
  }
  const timeoutMs = g.timeoutMs;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 0 || timeoutMs > 60000) invalid(`${what}.timeoutMs must be an integer from 0 to 60000 (0 uses the default)`);
  return { enabled, sidecarUrl, timeoutMs, blockAgreement: oneOf(g.blockAgreement, BLOCK_AGREEMENTS, `${what}.blockAgreement`), failClosed: bool(g.failClosed, `${what}.failClosed`, false) };
}

function validateKeyBody(b, { partial = false, existing = null } = {}) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) invalid('body must be an object');
  const name = partial && b.name === undefined ? existing.name : str(b.name ?? existing?.name, 'name', 40);
  if (!NAME_RE.test(name)) invalid('name must be 3-40 characters of a-z, 0-9 and hyphen (no leading or trailing hyphen)');
  const custodian = partial && b.custodian === undefined ? existing.custodian : oneOf(b.custodian ?? existing?.custodian, CUSTODIANS, 'custodian');
  const scopes = partial && b.scopes === undefined ? existing.scopes : (Array.isArray(b.scopes) && b.scopes.length && b.scopes.every((s) => SCOPES.includes(s))
    ? [...new Set(b.scopes)]
    : invalid('scopes must be a non-empty array drawn from llm, mcp, a2a'));
  let provider = partial && b.provider === undefined ? existing.provider : (b.provider ?? null);
  if (provider !== null) str(provider, 'provider', 40);
  if (scopes.includes('llm') && !provider) invalid('an llm-scoped key needs a provider (the real upstream key is stored server-side in the product; this mock stores none)');
  if (!scopes.includes('llm') && provider) invalid('provider applies only to llm-scoped keys');
  const allowedModels = partial && b.allowedModels === undefined ? existing.allowedModels
    : (Array.isArray(b.allowedModels) ? b.allowedModels.slice(0, MAX_MODELS).map((m) => str(m, 'allowedModels entry', 60)) : invalid('allowedModels must be an array'));
  if (scopes.includes('llm') && !allowedModels.length) invalid('an llm-scoped key needs at least one allowed model');
  if (!scopes.includes('llm') && allowedModels.length) invalid('allowedModels applies only to llm-scoped keys');
  const rpm = partial && b.rpm === undefined ? existing.rpm : b.rpm;
  if (!Number.isInteger(rpm) || rpm < RATE_LIMIT.rpm[0] || rpm > RATE_LIMIT.rpm[1]) invalid(`rpm must be an integer from ${RATE_LIMIT.rpm[0]} to ${RATE_LIMIT.rpm[1]}`);
  const tpm = partial && b.tpm === undefined ? existing.tpm : b.tpm;
  if (!Number.isInteger(tpm) || tpm < RATE_LIMIT.tpm[0] || tpm > RATE_LIMIT.tpm[1]) invalid(`tpm must be an integer from ${RATE_LIMIT.tpm[0]} to ${RATE_LIMIT.tpm[1]}`);
  let expiresAt = partial && b.expiresAt === undefined ? existing.expiresAt : (b.expiresAt ?? null);
  if (expiresAt !== null) {
    const t = Date.parse(expiresAt);
    if (Number.isNaN(t) || t < Date.now() + FUTURE_MS) invalid('expiresAt must be a future date (at least one day out)');
    expiresAt = new Date(t).toISOString();
  }
  const apps = partial && b.apps === undefined ? existing.apps : (Array.isArray(b.apps) ? b.apps : invalid('apps must be an array of app ids'));
  const tools = partial && b.tools === undefined ? existing.tools : (Array.isArray(b.tools) ? b.tools : invalid('tools must be an array of tool names'));
  const guardrail = partial && b.guardrail === undefined ? existing.guardrail : validateGuardrail(b.guardrail);
  if (!partial) {
    if (b.enabled !== undefined || b.id !== undefined || b.keyValue !== undefined || b.revoked !== undefined) invalid('unknown field');
  }
  return { name, custodian, provider, scopes, allowedModels, rpm, tpm, expiresAt, apps, tools, guardrail };
}

function validateAppBody(b, { partial = false, existing = null } = {}) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) invalid('body must be an object');
  const name = partial && b.name === undefined ? existing.name : str(b.name ?? existing?.name, 'name', 40);
  if (!NAME_RE.test(name)) invalid('name must be 3-40 characters of a-z, 0-9 and hyphen (no leading or trailing hyphen)');
  const type = partial && b.type === undefined ? existing.type : oneOf(b.type ?? existing?.type, ['mcp'], 'type');
  const mcpUrl = partial && b.mcpUrl === undefined ? existing.mcpUrl : str(b.mcpUrl ?? existing?.mcpUrl, 'mcpUrl', 300);
  if (!/^https?:\/\/[a-z0-9.-]+(:\d+)?(\/\S*)?$/i.test(mcpUrl)) invalid('mcpUrl must be an http(s) URL (use .invalid or .example hosts)');
  const tools = partial && b.tools === undefined ? existing.tools : (Array.isArray(b.tools) && b.tools.length ? b.tools.slice(0, 50).map((t) => str(t, 'tools entry', 60)) : invalid('tools must be a non-empty array of tool names'));
  const published = partial && b.published === undefined ? existing.published : bool(b.published, 'published', true);
  return { name, type, mcpUrl, tools, published };
}

// A key's grant, derived from the apps it selects (the product auto-creates the policy; this mock derives the view).
export function grantFor(key, apps) {
  if (!key.scopes.includes('mcp') && !key.scopes.includes('a2a')) return { policy: null, why: 'the key has no mcp or a2a scope, so no app grant is created' };
  const chosen = apps.filter((a) => key.apps.includes(a.id));
  if (!chosen.length) return { policy: null, why: 'no app selected: no grant' };
  return {
    policy: {
      id: `grant-${key.id}`,
      issuedTo: key.custodian,
      key: key.name,
      apps: chosen.map((a) => ({ id: a.id, name: a.name, tools: a.tools })),
      toolFilter: key.tools.length ? key.tools : null, // null = all published tools of the selected apps
    },
  };
}

// Effective policy for a caller presenting key `keyName` against app `appName` and tool `tool`.
// The guardrail check itself stays in the gateway; this only answers "is the call allowed at all".
export function accessDecision(keys, apps, { keyName, appName, tool }) {
  const key = keys.find((k) => k.name === keyName);
  if (!key) return { allowed: false, status: 401, reason: 'invalid_virtual_key' };
  if (key.revoked) return { allowed: false, status: 401, reason: 'key_revoked' };
  if (key.expiresAt && Date.parse(key.expiresAt) < Date.now()) return { allowed: false, status: 401, reason: 'key_expired' };
  if (!key.scopes.includes('mcp')) return { allowed: false, status: 403, reason: 'key_not_scoped_for_mcp_access' };
  const app = apps.find((a) => a.name === appName);
  if (!app) return { allowed: false, status: 404, reason: 'no_such_app' };
  if (!key.apps.includes(app.id)) return { allowed: false, status: 403, reason: 'policy_denied_app_not_granted' };
  if (!app.tools.includes(tool)) return { allowed: false, status: 404, reason: 'no_such_tool' };
  if (key.tools.length && !key.tools.includes(tool)) return { allowed: false, status: 403, reason: 'tool_not_granted' };
  return { allowed: true, status: 200, reason: 'permitted', key, app };
}

export function createRegistry({ apps = DEFAULT_APPS, keys = DEFAULT_KEYS } = {}) {
  let appList = structuredClone(apps);
  let keyList = structuredClone(keys);
  const keyValues = new Map(keyList.map((k) => [k.id, `vk-mock-${randomUUID().replace(/-/g, '').slice(0, 24)}`]));

  const view = (k) => ({
    id: k.id, name: k.name, custodian: k.custodian, provider: k.provider, scopes: k.scopes,
    allowedModels: k.allowedModels, rpm: k.rpm, tpm: k.tpm, expiresAt: k.expiresAt, revoked: k.revoked,
    apps: k.apps, tools: k.tools, guardrail: { ...k.guardrail },
    keyValue: keyValues.get(k.id) ?? null, // mock-issued, labelled, rule 4 exception
    expired: k.expiresAt ? Date.parse(k.expiresAt) < Date.now() : false,
  });
  const appView = (a) => ({ ...a });

  return {
    listApps: () => appList.map(appView),
    listKeys: () => keyList.map(view),
    keyByName: (n) => keyList.find((k) => k.name === n) ?? null,

    addApp(body) {
      if (appList.length >= MAX_APPS) invalid(`at most ${MAX_APPS} apps`);
      const v = validateAppBody(body);
      if (appList.some((a) => a.name === v.name)) invalid(`an app named ${v.name} already exists`);
      const app = { id: `app-${randomUUID().replace(/-/g, '').slice(0, 8)}`, ...v };
      appList.push(app);
      return appView(app);
    },
    updateApp(id, body) {
      const a = appList.find((x) => x.id === id);
      if (!a) invalid('no such app');
      const v = validateAppBody(body, { partial: true, existing: a });
      if (appList.some((x) => x.name === v.name && x.id !== id)) invalid(`an app named ${v.name} already exists`);
      Object.assign(a, v);
      return appView(a);
    },
    deleteApp(id) {
      const i = appList.findIndex((x) => x.id === id);
      if (i < 0) invalid('no such app');
      const [gone] = appList.splice(i, 1);
      for (const k of keyList) k.apps = k.apps.filter((x) => x !== id);
      return { ok: true, id: gone.id };
    },

    addKey(body) {
      if (keyList.length >= MAX_KEYS) invalid(`at most ${MAX_KEYS} keys`);
      const v = validateKeyBody(body);
      if (keyList.some((k) => k.name === v.name)) invalid(`a key named ${v.name} already exists`);
      const key = { id: `key-${randomUUID().replace(/-/g, '').slice(0, 8)}`, ...v, revoked: false };
      keyList.push(key);
      keyValues.set(key.id, `vk-mock-${randomUUID().replace(/-/g, '').slice(0, 24)}`);
      return view(key);
    },
    updateKey(id, body) {
      const k = keyList.find((x) => x.id === id);
      if (!k) invalid('no such key');
      const v = validateKeyBody(body, { partial: true, existing: k });
      if (keyList.some((x) => x.name === v.name && x.id !== id)) invalid(`a key named ${v.name} already exists`);
      Object.assign(k, v);
      return view(k);
    },
    revokeKey(id) {
      const k = keyList.find((x) => x.id === id);
      if (!k) invalid('no such key');
      k.revoked = true;
      return view(k);
    },
    deleteKey(id) {
      const i = keyList.findIndex((x) => x.id === id);
      if (i < 0) invalid('no such key');
      const [gone] = keyList.splice(i, 1);
      keyValues.delete(gone.id);
      return { ok: true, id: gone.id };
    },

    accessDecision(opts) {
      const d = accessDecision(keyList, appList, opts);
      return d.key ? { ...d, key: undefined, keyName: d.key.name, guardrail: { ...d.key.guardrail } } : d;
    },
    grantFor(keyId) {
      const k = keyList.find((x) => x.id === keyId);
      return k ? grantFor(k, appList) : { policy: null, why: 'no such key' };
    },

    reset() {
      appList = structuredClone(apps);
      keyList = structuredClone(keys);
      keyValues.clear();
      for (const k of keyList) keyValues.set(k.id, `vk-mock-${randomUUID().replace(/-/g, '').slice(0, 24)}`);
    },
  };
}

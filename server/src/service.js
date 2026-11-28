// Orchestrates the demo: gateway config, caller profiles, scenario runs (serialised, capped queue), the decision log,
// the fault injector and reset. All text that is stored or returned has been masked and made inert upstream of here.
import { createDecisionLog } from './decisions.js';
import { complianceFor } from './compliance.js';
import { createBehaviour } from './behaviour.js';
import { CALLERS, listScenarios, scenarioById } from './scenarios.js';
import { DEFAULT_GATEWAY_CONFIG, Invalid, createGateway, validateGatewayConfig, validateTimeout } from './gateway.js';
import { DEFAULT_SIDECAR_CONFIG } from './sidecar.js';
import { STAND_IN_LIMITS, detectInjection, classify } from './detectors.js';
import { safeSnippet } from './sidecar.js';
import { PromptLogInvalid, createPromptLog } from './promptlog.js';
import { importToml } from './rules.js';
import { LEGACY_KINDS } from './pii.js';
import { h2Overview } from './h2.js';
import { createRegistry } from './registry.js';

export const MAX_QUEUE = 4;
export const CUSTOM_MAX_CHARS = 4000;
export { Invalid };

export class QueueFull extends Error {}
export class SidecarDown extends Error {}
// A refusal that carries the list of reasons (a rejected rule paste, a rejected prompt-log setting).
export class Refused extends Invalid { constructor(message, details, key) { super(message); this.details = details; this.key = key; } }

export function createService({ sidecarUrl, fetchImpl, decisions = createDecisionLog(), workspace, registry = createRegistry() } = {}) {
  const gateway = createGateway({ sidecarUrl, fetchImpl, workspace });
  let config = structuredClone(DEFAULT_GATEWAY_CONFIG);
  const behaviour = createBehaviour();
  const promptLog = createPromptLog();
  let localRules = []; // compiled copy of the pasted rules, used only to mask text shown back (the sidecar keeps its own)

  // One run at a time (faults and config are shared state); at most MAX_QUEUE waiting or running.
  let chain = Promise.resolve(); let pending = 0;
  const enqueue = (fn) => {
    if (pending >= MAX_QUEUE) throw new QueueFull('run queue is full');
    pending += 1;
    const p = chain.then(fn, fn);
    chain = p.catch(() => {}).finally(() => { pending -= 1; });
    return p;
  };

  const adminOk = async (method, path, body) => {
    let r;
    try { r = await gateway.admin(method, path, body); } catch { throw new SidecarDown('the sidecar is not reachable'); }
    if (r.status !== 200 || !r.json) throw new SidecarDown(`the sidecar answered ${r.status} on ${path}`);
    return r.json;
  };

  const policyFor = (run) => {
    const caller = run.caller ? CALLERS[run.caller] : null;
    return {
      failClosed: run.failClosed ?? config.failClosed,
      timeoutMs: run.timeoutMs ?? config.timeoutMs,
      blockThresholds: caller ? caller.blockThresholds : config.blockThresholds,
      sanitizeMode: run.sanitizeMode ?? config.sanitizeMode,
    };
  };

  async function executeRun(run, meta) {
    const policy = policyFor(run);
    let restore = null;
    if (run.fault) {
      restore = (await adminOk('GET', '/demo/fault')).fault;
      await adminOk('PUT', '/demo/fault', run.fault);
    }
    let result;
    try {
      result = await gateway.run({ requestText: run.requestText, requestRole: run.requestRole, upstreamText: run.upstreamText, policy });
    } finally {
      if (restore) await adminOk('PUT', '/demo/fault', restore).catch(() => {});
    }
    const expectationMet = run.expect ? ['outcome', 'blockedAt', 'reason'].every((k) => result[k] === run.expect[k]) : null;
    // Model-based second layer (deck claim, informs only): the stand-in's own label scores beside the sidecar's
    // verdict, so the viewer can compare the two models on the same text without another call.
    const secondLayer = { standIn: classify(run.requestText).scores, sidecarOk: result.stages[0]?.sidecar?.ok ?? false };
    const categories = [...new Set(result.stages.flatMap((st) => (st.evaluations ?? []).map((e) => e.category)))];
    // Compliance tags (lab-invented) and behavioural scoring (informs only) ride on the same entry.
    const compliance = complianceFor({ categories, outcome: result.outcome, reason: result.reason });
    const behaviourLevel = run.caller ? behaviour.record(run.caller, categories.length) : null;
    const entry = decisions.add({
      source: meta.source, scenario: meta.scenario ?? null, label: run.label, caller: run.caller ?? null,
      policy: { ...policy, blockThresholds: { ...policy.blockThresholds } },
      injectedFault: run.fault?.mode ?? null,
      ...result, expected: run.expect ?? null, expectationMet, secondLayer, compliance,
      ...(behaviourLevel ? { behaviour: behaviourLevel } : {}),
    });
    const logged = promptLog.record({ surface: run.requestRole === 'a2a_message' ? 'a2a' : 'llm', requestText: run.requestText, upstreamText: run.upstreamText, caller: run.caller ?? null, result, categories });
    return { ...entry, promptLog: logged.recorded ? { recorded: true, id: logged.record.id, kid: logged.record.kid } : { recorded: false, why: logged.why } };
  }

  const api = {
    gateway, decisions, registry,
    getConfig: () => structuredClone(config),

    async getFullConfig() {
      let sidecar = null; let fault = null; let sidecarError = null;
      try { const j = await adminOk('GET', '/demo/config'); sidecar = j.config; fault = j.fault; } catch (e) { sidecarError = e.message; }
      return { gateway: structuredClone(config), sidecar, fault, sidecarError, defaults: { gateway: DEFAULT_GATEWAY_CONFIG, sidecar: DEFAULT_SIDECAR_CONFIG }, callers: CALLERS };
    },

    // body: { gateway?: {...}, sidecar?: {...} } each part complete and validated before anything changes.
    putConfig(body) {
      if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length || Object.keys(body).some((k) => k !== 'gateway' && k !== 'sidecar')) {
        throw new Invalid('body must contain gateway and/or sidecar');
      }
      const g = body.gateway === undefined ? null : validateGatewayConfig(body.gateway);
      return enqueue(async () => {
      if (body.sidecar !== undefined) {
        const r = await gateway.admin('PUT', '/demo/config', body.sidecar).catch(() => { throw new SidecarDown('the sidecar is not reachable'); });
        if (r.status === 400) throw new Invalid(String(r.json?.message ?? 'invalid sidecar config').slice(0, 200));
        if (r.status !== 200) throw new SidecarDown(`the sidecar answered ${r.status}`);
      }
      if (g) config = g;
      return api.getFullConfig();
      });
    },

    putFault(fault) {
      return enqueue(async () => {
      const r = await gateway.admin('PUT', '/demo/fault', fault).catch(() => { throw new SidecarDown('the sidecar is not reachable'); });
      if (r.status === 400) throw new Invalid(String(r.json?.message ?? 'invalid fault').slice(0, 200));
      if (r.status !== 200) throw new SidecarDown(`the sidecar answered ${r.status}`);
      return r.json;
      });
    },
    getFault: () => adminOk('GET', '/demo/fault'),

    listScenarios,

    runScenario(id) {
      const s = scenarioById(id);
      if (!s) return null;
      return enqueue(async () => {
        const runs = [];
        for (const run of s.runs) runs.push(await executeRun(run, { source: 'scenario', scenario: s.id }));
        return { scenario: s.id, title: s.title, teaches: s.teaches, knownLimit: s.knownLimit ?? null, runs, allExpectationsMet: runs.every((r) => r.expectationMet) };
      });
    },

    // A guardrail-only run for the Agent Registry "try a call" flow. `run` carries its own policy:
    // { label, requestText, requestRole, upstreamText, failClosed, timeoutMs?, policy: { blockThresholds, forceInspect } }.
    // forceInspect=false means the key's guardrail is OFF: the text is never inspected and the call is allowed.
    runPolicy(run) {
      return enqueue(async () => {
        if (run.policy?.forceInspect === false) {
          const entry = decisions.add({
            source: 'registry', scenario: null, label: run.label, caller: run.caller ?? null,
            policy: { failClosed: run.failClosed, timeoutMs: config.timeoutMs, blockThresholds: { ...GATEWAY_DEFAULT_THRESHOLDS } },
            injectedFault: null, outcome: 'allow', blockedAt: null, reason: 'guardrail_disabled', stages: [], expected: null, expectationMet: null,
          });
          return { scenario: null, title: run.label, runs: [entry] };
        }
        const policy = {
          failClosed: run.failClosed ?? config.failClosed,
          timeoutMs: run.timeoutMs ?? config.timeoutMs,
          blockThresholds: run.policy?.blockThresholds ?? config.blockThresholds,
        };
        const result = await gateway.run({ requestText: run.requestText, requestRole: run.requestRole, upstreamText: run.upstreamText ?? '', policy });
        const entry = decisions.add({
          source: 'registry', scenario: null, label: run.label, caller: run.caller ?? null,
          policy: { ...policy, blockThresholds: { ...policy.blockThresholds } },
          injectedFault: null, ...result, expected: null, expectationMet: null,
        });
        return { scenario: null, title: run.label, runs: [entry] };
      });
    },

    // custom: { requestText, upstreamText?, caller?, failClosed? }
    runCustom(c) {      if (!c || typeof c !== 'object' || Array.isArray(c)) throw new Invalid('custom must be an object');
      const extra = Object.keys(c).filter((k) => !['requestText', 'upstreamText', 'caller', 'failClosed', 'timeoutMs', 'sanitizeMode'].includes(k));
      if (extra.length) throw new Invalid('unknown field (name hidden); allowed: requestText, upstreamText, caller, failClosed, timeoutMs, sanitizeMode');
      if (typeof c.requestText !== 'string' || !c.requestText.trim() || c.requestText.length > CUSTOM_MAX_CHARS) throw new Invalid(`requestText must be 1-${CUSTOM_MAX_CHARS} characters`);
      if (c.upstreamText !== undefined && (typeof c.upstreamText !== 'string' || c.upstreamText.length > CUSTOM_MAX_CHARS)) throw new Invalid(`upstreamText must be at most ${CUSTOM_MAX_CHARS} characters`);
      if (c.caller !== undefined && !(typeof c.caller === 'string' && Object.hasOwn(CALLERS, c.caller))) throw new Invalid(`caller must be one of ${Object.keys(CALLERS).join(', ')}`);
      if (c.failClosed !== undefined && typeof c.failClosed !== 'boolean') throw new Invalid('failClosed must be a boolean');
      if (c.timeoutMs !== undefined) validateTimeout(c.timeoutMs);
      if (c.sanitizeMode !== undefined && c.sanitizeMode !== 'off' && c.sanitizeMode !== 'on') throw new Invalid('sanitizeMode must be "off" or "on"');
      const run = { label: 'Custom text', requestText: c.requestText, upstreamText: c.upstreamText ?? '', caller: c.caller, failClosed: c.failClosed, timeoutMs: c.timeoutMs, sanitizeMode: c.sanitizeMode, requestRole: c.caller ? 'a2a_message' : 'user_prompt' };
      return enqueue(async () => ({ scenario: null, title: 'Custom text', runs: [await executeRun(run, { source: 'custom' })] }));
    },

    // The stand-in's documented limits, computed by the live detector with the current sidecar settings.
    // Real mode talks to an external sidecar that has no /demo admin endpoints: the panel answers honestly
    // that the stand-in calibration is a Mock-side feature instead of a 503.
    async standIn() {
      let cfg;
      try { cfg = (await adminOk('GET', '/demo/config')).config; }
      catch {
        return {
          engine: 'external-sidecar', realClassifier: true,
          notice: 'Real mode: findings come from the external sidecar you configured. The stand-in calibration panel (thresholds, benign labels, known limits) is a Mock-side feature and is not available here.',
          limits: [],
        };
      }
      return {
        engine: 'stand-in-heuristics', realClassifier: false,
        notice: 'A deterministic keyword stand-in. It says nothing about the detection quality, defaults or licensing of any real product.',
        limits: STAND_IN_LIMITS.map((l) => ({ id: l.id, kind: l.kind, text: l.text, why: l.why, flagged: detectInjection(l.text, cfg.detector).blocked })),
      };
    },

    decisionList: () => decisions.list(),

    // H2 2026 release features. Your own gitleaks-format rules live in the sidecar (one set per workspace); one bad rule refuses the whole paste.
    getRules: () => adminOk('GET', '/demo/rules'),
    putRules(toml) {
      if (typeof toml !== 'string') throw new Invalid('toml must be a string');
      return enqueue(async () => {
        const r = await gateway.admin('PUT', '/demo/rules', { toml }).catch(() => { throw new SidecarDown('the sidecar is not reachable'); });
        if (r.status === 400 && Array.isArray(r.json?.Errors)) throw new Refused(r.json.message, r.json.Errors.slice(0, 50).map((e) => safeSnippet(e, 400)), 'Errors');
        if (r.status === 400) throw new Invalid(String(r.json?.message ?? 'invalid paste').slice(0, 200));
        if (r.status !== 200 || !r.json) throw new SidecarDown(`the sidecar answered ${r.status}`);
        localRules = [...localRules, ...importToml(toml, localRules).Added];
        gateway.setMaskRules(localRules);
        return r.json;
      });
    },
    clearRules() {
      return enqueue(async () => {
        await adminOk('DELETE', '/demo/rules');
        localRules = []; gateway.setMaskRules([]);
        return { ok: true };
      });
    },
    async h2() { return h2Overview((await adminOk('GET', '/demo/config')).config.piiKinds ?? LEGACY_KINDS); },
    promptLogView: () => promptLog.view(),
    putPromptLog(body) {
      return enqueue(async () => {
        try { promptLog.put(body); } catch (e) { if (e instanceof PromptLogInvalid) throw new Refused(e.message, e.errors, 'errors'); throw e; }
        return promptLog.view();
      });
    },

    reset() {
      return enqueue(async () => {
        config = structuredClone(DEFAULT_GATEWAY_CONFIG);
        decisions.clear();
        promptLog.reset(); localRules = []; gateway.setMaskRules([]); behaviour.reset();
        await adminOk('DELETE', '/demo/rules');
        await adminOk('PUT', '/demo/config', DEFAULT_SIDECAR_CONFIG);
        await adminOk('PUT', '/demo/fault', { mode: 'none', delayMs: 0 });
        registry.reset();
      });
    },
  };
  return api;
}

// The gateway thresholds the registry "try a call" uses (the demo's defaults; a key grant does not carry its own).
export const GATEWAY_DEFAULT_THRESHOLDS = Object.freeze({ prompt_injection: 'medium', jailbreak: 'none', pii: 'high' });

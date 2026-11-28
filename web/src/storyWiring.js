// Story wiring: the lab's own glue between the shared Story engine (web/src/story/, vendored) and this page. It turns the script (storyScript.js) into engine
// steps and gives the engine a `host` that reads and drives the page: the tabs, the call pickers, the run events. It never edits the page's own markup; it
// clicks the page's own buttons with script-made events (isTrusted is false, so Play for me is not mistaken for the viewer's own input).
//
// The page announces runs with aidemo:run-start and aidemo:run-end ({ ok }): ok is false only when the request itself failed. A call the guardrail blocks
// completes normally (the block is the verdict), so it is a run that ended ok.

import { STEPS } from './storyScript.js';

const text = (el) => (el && el.textContent ? el.textContent.trim() : '');

export function createHost({ win = window, doc = document, mode = () => 'mock', settleMs = 400 } = {}) {
  const runs = { starts: 0, ends: 0, lastOk: true };
  const waiters = new Set();
  const timers = new Set();
  const watchers = new Set();
  const onStart = () => { runs.starts += 1; watchers.forEach((f) => f()); };
  const onEnd = (e) => {
    runs.ends += 1; runs.lastOk = e.detail ? e.detail.ok !== false : true;
    for (const w of [...waiters]) w(runs.lastOk);
    watchers.forEach((f) => f());
  };
  // A Reset empties the page: a step waiting for a run is told so.
  const onReset = () => { for (const w of [...waiters]) w(false, 'The page was reset. Press Next to carry on, or Exit.'); };
  win.addEventListener('aidemo:run-start', onStart);
  win.addEventListener('aidemo:run-end', onEnd);
  win.addEventListener('aidemo:reset', onReset);

  const q = (sel) => doc.querySelector(sel);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (el) => { if (!el || el.disabled) throw new Error('the control is not available'); el.click(); };

  return {
    mode,
    query: q,
    mark: () => ({ starts: runs.starts, ends: runs.ends }),
    runStarted: (m) => runs.starts > m.starts,
    runInFlight: () => runs.starts > runs.ends,
    onRun: (cb) => { watchers.add(cb); return () => watchers.delete(cb); },
    waitForRun(m, timeoutMs) {
      return new Promise((resolve) => {
        const finish = (r) => { clearTimeout(t); timers.delete(t); waiters.delete(check); resolve(r); };
        const done = (ok, reason) => finish(ok ? { ok: true } : { ok: false, reason: reason || 'The run failed. Press Next to carry on, or Exit.' });
        const check = (ok, reason) => { if (reason || runs.ends > m.ends) done(ok, reason); };
        const t = setTimeout(() => finish({ ok: false, reason: 'The run did not finish in time. Press Next to carry on, or Exit.' }), timeoutMs);
        timers.add(t);
        if (runs.ends > m.ends) { done(runs.lastOk); return; }
        waiters.add(check);
      });
    },
    prefill(step) {
      if (!step.prompt || !step.prompt.text) return;
      const input = q(step.target);
      if (!input) return;
      input.value = step.prompt.text;
      input.dispatchEvent(new win.Event('input', { bubbles: true }));
    },
    send(step) {
      if (step.prompt && step.prompt.press) {
        // A press on a <select> opens the picker instead of running; the call flow is driven by the wiring's callFlow below.
        const el = q(step.prompt.press);
        if (el && el.id === 'call-key') return callFlow(doc, host, { keyName: 'research-agent', appName: 'airline', tool: 'search_flights' });
        click(el);
        return;
      }
      click(q(step.target));
    },
    switchTab(tab) {
      const el = q(`#tab-${tab}`);
      if (el && el.getAttribute('aria-current') !== 'page') el.click();
    },
    assetUrl: () => null,   // no screenshot ships; a slide is text-only
    dispose() { win.removeEventListener('aidemo:run-start', onStart); win.removeEventListener('aidemo:run-end', onEnd); win.removeEventListener('aidemo:reset', onReset); timers.forEach(clearTimeout); timers.clear(); waiters.clear(); watchers.clear(); },
    _sleep: sleep, _settleMs: settleMs,
  };
}

// The try-a-call flow: fill the three selects, then press Send. Script-made events only.
async function callFlow(doc, host, { keyName = 'payments-agent', appName = 'airline', tool = 'search_flights' } = {}) {
  const setSelect = (id, value) => {
    const el = doc.getElementById(id);
    if (!el) return false;
    const has = [...el.options].some((o) => o.value === value);
    if (!has) return false;
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };
  if (!setSelect('call-key', keyName)) throw new Error(`the ${keyName} key is not in the picker (was Reset pressed?)`);
  setSelect('call-app', appName);
  await host._sleep(100);
  setSelect('call-tool', tool);
  await host._sleep(100);
  const send = [...doc.querySelectorAll('[data-testid=call-card] button')].find((b) => text(b) === 'Send the call');
  click(send);
}

// ---- finding what a bubble points at (plain CSS; querySelector supports :has in current browsers)
const firstSentence = (s, limit = 150) => {
  let t = String(s || '').trim().split('\n')[0] || '';
  if (t.length <= limit) return t;
  const head = t.slice(0, limit);
  const sp = head.lastIndexOf(' ');
  return `${sp > 0 ? head.slice(0, sp) : head}...`;
};

// The live fact lines a bubble shows (read from the page, never invented).
function linesFor(doc, step) {
  switch (step.lines) {
    case 'callVerdict': return () => {
      const p = doc.querySelector('[data-testid=call-result] .recorded');
      return p ? [firstSentence(text(p))] : [];
    };
    default: return undefined;
  }
}

// Conditions: none today (the call bubbles gate themselves on the page's own result).
const CONDITIONS = {};

/** The script as engine steps. `captions` is /api/story. */
export function buildSteps({ captions, host, doc = document, win = window, script = STEPS, notYet = [] }) {
  let tab;
  return script.filter((s) => !notYet.includes(s.key)).map((s) => {
    if (s.tab) tab = s.tab;
    const step = { key: s.key, type: s.type, trigger: s.trigger, modes: s.modes, sampleKey: s.sampleKey, prefer: s.prefer, place: s.place, fixedSecs: s.fixedSecs, frameTimeoutMs: s.frameTimeoutMs, tab };
    if (s.prompt) step.prompt = s.prompt;
    if (s.when) step.when = CONDITIONS[s.when] ? CONDITIONS[s.when](doc) : undefined;
    if (s.type === 'bubble') {
      step.target = s.target;
      const lines = linesFor(doc, s);
      if (lines) step.lines = lines;
    }
    return step;
  });
}

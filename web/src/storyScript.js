// The Story script: one entry per caption key, in the order the walk-through shows the lab. Pure data, no DOM: the wiring turns each entry into an
// engine step (a selector, a trigger, a live line). The wording is in story/captions.md; the parity test checks the two agree.
//
//   target   a CSS selector | { tab } helpers are expressed with engine `tab` (the wiring's switchTab)
//   prompt   { text } fill the input and the viewer presses Send | { press } the viewer (or Play) presses that existing button
//   lines    the name of a live value the page reads for the bubble's fact lines (the wiring)
//   modes    ['mock'] or ['real']: shown only there. sampleKey: the Mock wording key.
//   fixedSecs for Play for me: a fixed hold instead of the wording-length formula.

export const STEPS = [
  { key: 'opening', type: 'slide', trigger: 'load' },

  // ---- the sidecar demo tab (the demo tab is the page's default view)
  { key: 'sample_note', type: 'slide', trigger: 'load', modes: ['mock'] },   // the simulated walk-through says so first (with the rule-29 header)
  { key: 'intro', type: 'bubble', tab: 'demo', trigger: 'load', target: '#panel-demo .lede', prefer: 'below', sampleKey: 'sample_p1_intro' },
  { key: 'pick', type: 'bubble', tab: 'demo', trigger: 'load', target: '.picker', prefer: 'right' },
  { key: 'run', type: 'bubble', tab: 'demo', trigger: 'load', target: '.btn.primary', prefer: 'right', prompt: { press: '#panel-demo .btn.primary' } },
  { key: 'exchange', type: 'bubble', trigger: 'run-done', target: '[data-testid=result]', prefer: 'below', sampleKey: 'sample_exchange' },
  { key: 'thresholds', type: 'bubble', trigger: 'load', target: '#panel-demo input[type=range]', prefer: 'above' },
  { key: 'fail_closed', type: 'bubble', trigger: 'load', target: '#panel-demo .card:has(#custom-text)', prefer: 'below' },
  { key: 'stand_in', type: 'bubble', trigger: 'load', target: '#panel-demo .card:has(#custom-reply)', prefer: 'below' },
  { key: 'log', type: 'bubble', trigger: 'load', target: '#panel-demo .card:has(table), #panel-demo .log', prefer: 'above' },

  // ---- the Agentic Apps tab
  { key: 'apps_intro', type: 'slide', trigger: 'load' },
  { key: 'apps_route', type: 'bubble', tab: 'apps', trigger: 'load', target: '[data-testid=app-route-airline]', prefer: 'right' },
  { key: 'apps_edit', type: 'bubble', tab: 'apps', trigger: 'load', target: '[data-testid=add-app]', prefer: 'below' },

  // ---- the Agent Registry tab
  { key: 'keys', type: 'bubble', tab: 'registry', trigger: 'load', target: '[data-testid=keys-table]', prefer: 'above' },
  { key: 'key_scopes', type: 'bubble', tab: 'registry', trigger: 'load', target: '[data-testid=key-row-payments-agent]', prefer: 'above' },
  { key: 'key_grant', type: 'bubble', tab: 'registry', trigger: 'load', target: '[data-testid=keys-table]', prefer: 'above' },
  { key: 'call_intro', type: 'bubble', tab: 'registry', trigger: 'load', target: '[data-testid=call-card]', prefer: 'above' },
  { key: 'call_allowed', type: 'bubble', tab: 'registry', trigger: 'run-done', target: '[data-testid=call-result]', prefer: 'above', lines: 'callVerdict', sampleKey: 'sample_call_allowed', prompt: { press: '#call-key' } },
  { key: 'call_refused', type: 'bubble', tab: 'registry', trigger: 'run-done', target: '[data-testid=call-result]', prefer: 'above', lines: 'callVerdict', sampleKey: 'sample_call_refused', prompt: { press: '#call-key' } },
  { key: 'call_blocked', type: 'bubble', tab: 'registry', trigger: 'run-done', target: '[data-testid=call-result]', prefer: 'above', lines: 'callVerdict', sampleKey: 'sample_call_blocked' },

  // ---- Part 2 slide (the registry) and the end
  { key: 'part2', type: 'slide', trigger: 'load' },
  { key: 'closing', type: 'slide', trigger: 'load' },
];

// Mock wording the script uses that is not a step of its own: none beyond the sampleKey steps.
export const EXTRA_SAMPLE_KEYS = [];

// Bubbles only Story has (no video exists for this lab).
export const STORY_ONLY = [];
export const VIDEO_ONLY = [];

// What the parity test hands to captions.js parity(): the caption keys this script needs.
export function scriptKeys() {
  return {
    steps: STEPS.filter((s) => s.type === 'bubble').map((s) => s.key),
    slides: STEPS.filter((s) => s.type === 'slide').map((s) => s.key),
    sampleKeys: [...STEPS.map((s) => s.sampleKey).filter(Boolean), ...EXTRA_SAMPLE_KEYS],
  };
}

// Compliance mapping (lab-invented, labelled as such): a demo's own table from a run's categories and outcome to
// governance frameworks the deck name-checks. It informs a governance conversation; it claims nothing about any
// product's compliance features.

export const FRAMEWORKS = [
  { id: 'nist-ai-rmf', label: 'NIST AI-RMF', note: 'the framework functions a decision touches' },
  { id: 'eu-ai-act', label: 'EU AI Act', note: 'the deployer duties a decision supports' },
];

// category -> the controls the demo's own mapping says the decision exercises.
const CATEGORY_MAP = {
  prompt_injection: { 'nist-ai-rmf': ['MEASURE', 'MANAGE'], 'eu-ai-act': ['deployer-oversight'] },
  jailbreak: { 'nist-ai-rmf': ['MEASURE', 'MANAGE'], 'eu-ai-act': ['deployer-oversight'] },
  pii: { 'nist-ai-rmf': ['GOVERN', 'MAP', 'MEASURE'], 'eu-ai-act': ['data-governance', 'deployer-oversight'] },
};

const OUTCOME_MAP = {
  allow: { 'nist-ai-rmf': ['MEASURE'], 'eu-ai-act': [] },
  alert: { 'nist-ai-rmf': ['MEASURE', 'MANAGE'], 'eu-ai-act': ['deployer-oversight'] },
  block: { 'nist-ai-rmf': ['MANAGE'], 'eu-ai-act': ['deployer-oversight'] },
  sanitize: { 'nist-ai-rmf': ['MANAGE'], 'eu-ai-act': ['data-governance'] },
  sidecar_error_fail_closed: { 'nist-ai-rmf': ['MANAGE'], 'eu-ai-act': ['deployer-oversight'] },
  sidecar_error_fail_open: { 'nist-ai-rmf': ['MEASURE'], 'eu-ai-act': [] },
};

// One decision's tags: union of the category maps and the outcome's map. Unknown names map to 'unmapped', never an error.
export function complianceFor({ categories = [], outcome = 'allow', reason = null } = {}) {
  const out = {};
  for (const fw of FRAMEWORKS) out[fw.id] = new Set();
  const take = (table, key) => {
    const row = table[key];
    if (!row) { out['nist-ai-rmf'].add('unmapped'); out['eu-ai-act'].add('unmapped'); return; }
    for (const fw of FRAMEWORKS) for (const tag of row[fw.id] ?? []) out[fw.id].add(tag);
  };
  for (const c of categories) take(CATEGORY_MAP, c);
  const outcomeKey = reason?.startsWith('sidecar_error') ? reason : outcome;
  take(OUTCOME_MAP, outcomeKey);
  return Object.fromEntries(FRAMEWORKS.map(({ id }) => [id, [...out[id]]]));
}

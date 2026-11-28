// Behavioural scoring per calling key (lab-invented, informs only — it never decides): a rolling window of
// findings across a key's runs. A key that keeps tripping findings is annotated 'escalated' on the next
// decision, and the UI can show the level. In-memory, per service (per workspace), cleared by Reset.

const WINDOW = 100;          // runs remembered per key
const ESCALATE_FINDINGS = 3; // findings within ESCALATE_RUNS runs -> elevated
const ESCALATE_RUNS = 10;

export function createBehaviour({ windowSize = WINDOW, escalateFindings = ESCALATE_FINDINGS, escalateRuns = ESCALATE_RUNS } = {}) {
  // key -> [{ findings }] of the last windowSize runs, oldest first.
  let byKey = new Map();
  const history = (key) => {
    if (!byKey.has(key)) byKey.set(key, []);
    return byKey.get(key);
  };
  return {
    // Record one run for a key. findings: how many evaluations the run raised. Returns the level BEFORE this run
    // was counted... no: after, so the annotation describes the run being recorded.
    record(key, findings) {
      const h = history(key);
      h.push(findings);
      if (h.length > windowSize) h.shift();
      const recent = h.slice(-escalateRuns);
      const total = recent.reduce((a, b) => a + b, 0);
      return { level: total >= escalateFindings ? 'escalated' : 'normal', runs: recent.length, findings: total };
    },
    level(key) {
      const h = byKey.get(key);
      if (!h || !h.length) return { level: 'normal', runs: 0, findings: 0 };
      const recent = h.slice(-escalateRuns);
      const total = recent.reduce((a, b) => a + b, 0);
      return { level: total >= escalateFindings ? 'escalated' : 'normal', runs: recent.length, findings: total };
    },
    reset() { byKey = new Map(); },
  };
}

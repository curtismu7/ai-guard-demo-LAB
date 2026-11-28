# Spec: Four AI Guard capabilities (2026-11-28)

## What
Add four capabilities to ai-guard-demo-LAB's demo tab, one new card each, all on the existing run pipeline:

1. **Sanitize outcome.** The deck's fourth outcome. When the gateway's decision is ALLOW but findings exist at alert level, a per-workspace mode switch (`Off | Alert | Sanitize`) lets the gateway, instead of only alerting, forward the request with the offending text **masked** (same masking as display copies: PII → `[masked:kind]`, secrets redacted, hidden characters escaped). The run records `outcome: "sanitize"` with `sanitizedUnits` in the exchange; the UI shows before/after text. Block always wins over sanitize. Default: Off (current behaviour unchanged).
2. **Model-based second layer.** In Real mode, alongside the ProtectAI classifier verdict, run the same text through the stand-in and show **both scores side by side** (deck claim: model-based second layer). One row per stage: stand-in score vs real model score, agreement/dissent flagged. Mock mode shows one disabled row explaining Real is needed. Informs only; never decides.
3. **Compliance mapping.** Each decision in the run result gets framework tags: the demo's own mapping table (invented, labelled as such) from category+outcome to NIST AI-RMF functions (GOVERN/MAP/MEASURE/MANAGE) and EU AI Act roles (deployer oversight). Shown as chips under the decision; also stamped on decision-log entries.
4. **Behavioural scoring.** Per calling key, a rolling counter (in-memory, per workspace) of findings in the last N runs. Escalation: ≥3 findings in 10 runs → the next block decision also logs `behaviour: escalated` and the UI shows a per-key "recent behaviour" row (runs, findings, level: normal/elevated). Never blocks by itself — it only annotates and displays. Reset clears it.

## For whom
SE walkthroughs: after showing allow/alert/block, show governance-facing extras (sanitize, compliance) and honesty extras (second layer, behaviour).

## Acceptance
- Each feature has a visible card on the demo tab driven by real run data; each has server tests and web tests; all existing tests stay green.
- With every new control at its default (sanitize Off, no findings history), a run behaves byte-identically to today (same outcome, same stages).
- Reset restores all defaults and clears behaviour counters.

## Unhappy paths
- Sanitize: a unit that is entirely masking target → masked to empty → unit dropped, recorded as such. Invalid mode value → 400.
- Second layer: real classifier unreachable → row shows "unavailable", run unaffected.
- Behaviour: counters bounded (last 100 runs/key); no key (custom run, no caller) → no behaviour row.
- Compliance: unknown category → tag "unmapped", never an error.

## Out of scope
Real product behaviour claims (all tags stay "lab-invented" where they are), cross-workspace state, persistence beyond Reset, changes to the /inspect contract.

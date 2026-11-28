# PingOne Protect behavioral-risk layer spec

**Status:** draft  **Owner:** curtismu7

## Goal
Add a real PingOne Protect risk evaluation as a second, clearly-labeled signal on every
"try a call as a key" decision in ai-guard-demo-LAB, alongside the real ML text classifier.
The text verdict stays the classifier's; Protect contributes behavioral risk (level,
recommended action, reasons). The page states exactly what is real.

## Design
- New sidecar-facing module `server/src/protect.js` in the lab: calls PingOne
  `POST /v1/environments/<env>/riskEvaluations` with an event built from the call
  (IP, user-agent, `flow.type: "AUTHENTICATION"`-style event, `user.type: "EXTERNAL"`
  with the mock key's custodian as id, `targetResource` naming this demo). Worker
  token fetched server-side only, cached until expiry. Mirrors AI-DEMO2's proven
  `pingOneProtectService` pattern; no code is imported from AI-DEMO2 (different repo).
- Enabled only when `PINGONE_PROTECT_ENV_ID` + `PINGONE_PROTECT_WORKER_CLIENT_ID` +
  `PINGONE_PROTECT_WORKER_SECRET` are set in the lab `.env`; otherwise the feature is
  absent (no UI row, no API call). Region from `PINGONE_PROTECT_REGION` (default com).
- `/api/call` response gains `protect: { riskLevel, recommendedAction, reasons[], mode: "real" }`
  or is omitted when disabled/failed. Protect **never blocks or allows by itself** — it
  informs; the verdict remains identity → grant → tool filter → text classifier.
- UI (`web/src/components/RegistryTab.jsx`): when `protect` present, the result pane gains a
  "Behavioral risk (PingOne Protect)" row with level, action and reason count. Banner in
  Real mode updated: text findings = external ML model; behavioral risk = PingOne Protect.
- Closing-slide / captions wording in `story/captions.md` updated to match (video re-record
  is a separate, later decision).

## Acceptance criteria (runnable checks)
1. With creds set: a call's response JSON contains `protect.riskLevel` in
   {LOW, MEDIUM, HIGH, UNKNOWN} and `protect.recommendedAction`; `/api/decisions` log shows it.
2. Without creds: response has no `protect` key and no outbound call is made (unit test with
   fetch mocked to throw if called).
3. Worker token is never in any API response, log line, or browser-visible payload (grep tests).
4. Protect down / 4xx / timeout (10s): call still completes, no `protect` key, a warn line
   logged — fail-open, never blocks the demo (unit test).
5. Browser (Playwright MCP at 127.0.0.1:7900): with creds, allowed + refused calls both show the
   behavioral-risk row; without creds neither does. Screenshots read.
6. `cd web && npm run build` green; `python3 -m unittest` in `video/` still green.

## Unhappy paths (each with a check)
- Missing/partial env → feature silently absent, no crash (unit).
- Token fetch fails or expires mid-run → refetch once, then degrade to absent (unit).
- Protect 429/5xx/timeout → absent + warn, fail-open (unit).
- Odd input: custodian id with spaces/emoji → sent as-is in EXTERNAL user id, rejected by
  nothing (Protect treats it as opaque); long text unaffected (behavioral call ignores text).
- Rate limits during a recorded take → each call independent, absent row acceptable.

## Out of scope
- Protect influencing verdicts or policy (informs only).
- Re-recording the video; changing the classifier; real gateway/keys.
- Browser Signals SDK collection (no browser side; server-side event only).

## Protected / must not break
- The take contract: `ok: true`, `mask_leaks: 0`, 13 bubbles — captions edits keep count.
- Mock/Real toggle (rule 26) — untouched.
- Two-column call layout and existing tests.

## Verification plan
Unit tests for 1–4; browser run for 5 (both with-creds via owner-provided env and without);
build gate for 6. Owner approves before any redeploy of the shared standalone container and
before any video re-record.

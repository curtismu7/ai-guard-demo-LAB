# CLAUDE.md

AI Guard Demo (tier Demo, port 7900). An offline demo of how an external guardrail sidecar plugs into an agent gateway: a mock gateway posts request and response text to a sidecar `/inspect`, a deterministic stand-in detector answers, and per-category block thresholds, a Fail Closed toggle and a fault injector decide allow or block. Nothing real is touched. Overview, API and UI tour: [README.md](README.md). Presenter script: [docs/talk-track.md](docs/talk-track.md).

## Commands (from package.json)

```sh
npm install
npm test            # server + web + scripts/*.test.mjs
npm run build       # web UI into web/dist
npm run doctor      # preflight, exit 0 when sound and ports free
npm run e2e         # headless Chromium against the built UI (7901/7904)
npm run content-pack  # regenerate and validate content-pack.json
npm run talk-track    # regenerate docs/talk-track.md from content/talk-track.base.md + server/src/h2.js
npm start           # http://127.0.0.1:7900 (embedded sidecar 7903); build first
npm run sidecar     # standalone sidecar on 7902 (refused under MODE=se-mock)
```

Mode: `MODE=local` (default) is the demo. `MODE=se-mock` is the mock-only SE k8s build (rule 18): live settings refused, per-visitor workspaces (`X-Workspace-Id`), a hosted banner, manifests in `k8s/`. See [docs/k8s.md](docs/k8s.md). Nothing is deployed from here; the first SE deploy needs owner approval.

Ports: 7900 app, 7901 Vite dev, 7902 standalone sidecar, 7903 embedded sidecar, 7904-7905 e2e; tests 7930-7979. App range 7900-7909.

## Rules that bite here

- Mock-only build: in `se-mock` every new piece of app state belongs to a workspace (`server/src/workspaces.js`), and a new live setting must be added to `REFUSED_IN_SE_MOCK` in `config.js`. Do not add a process-wide mutable store.
- Loopback only, with the Host check and Origin / Sec-Fetch-Site checks on writes. No real network, no real tenants, no credentials accepted. Netguard test asserts zero outbound attempts.
- All user or sidecar text is rendered inert (hidden characters shown as `[U+XXXX]`, PII masked, secrets redacted). Keep it that way in new UI.
- Test scripts use globs (`test/*.test.js`), never a directory (fails on Node 22).
- Never use `crypto.generateKeyPairSync` or async `generateKeyPair` (SIGABRT on Node 20 in CI).
- Never parse `node:test` stdout; use the exit code.
- Forbidden-strings history scan must print 0; gitleaks runs in the pre-commit hook (`.githooks`). Never print the forbidden list.
- Docker is OrbStack only, never Docker Desktop. Compose publishes `127.0.0.1:7900` only.
- Mock-issued values are labelled. Product claims about the `/inspect` contract and gateway behaviour are UNVERIFIED unless a source is added; the detector is a stand-in.

## Story mode and Real mode

- Story mode: the shared engine is vendored byte-for-byte from `AI-DEMO-Standalone/shared/story` (commit at the time of vendoring, 2026-11-26) into `web/src/story/` and `server/src/story/`, pinned by `web/src/story/story.sha256` and checked by `scripts/story-checkPin.mjs` (called from `server/test/story.test.js`). NEVER edit a vendored copy: change `shared/story/` first (its own PR), then re-vendor and re-pin. The wording is `story/captions.md` (served at GET /api/story, re-read when it changes); the script is `web/src/storyScript.js`; the glue is `web/src/storyWiring.js` and `web/src/StoryRoot.jsx`; the toggle rides in the TopMenu `extra` slot. The parity test fails the build when the wording and the script disagree. Story works in Mock (sample_* wording, labelled simulated) and Real.
- Real mode: the Mock/Real toggle calls an external AI Guard sidecar at `AI_GUARD_SIDECAR_URL` (this app's own `.env` beside the compose file, gitignored; `.env.example` names the variables). Unset = Mock only; the toggle is then disabled with a how-to tooltip and POST /api/mode answers 409. The URL must be loopback http (rule: `assertSidecarUrl`); from the container a host sidecar is reachable only if you run the lab from a host checkout or attach a sidecar container to the same Docker network.

## H2 2026 release additions (Ping release claims, UNVERIFIED on our tenant)

A second tab, "H2 2026 release": selectable personal-data kinds (`pii.js`), bundled secret detectors (`secrets.js`), your own gitleaks-format rules (`toml.js`, `safeRegex.js`, `rules.js`) and prompt logging sealed to a key you hold (`seal.js`, `promptlog.js`, `web/src/lib/seal.js`). `h2.js` is the one source for the banner, the claim tags, Ping's numbers and the why-it-matters text: the API, the generated talk track and the content pack all read it.

- Never present Ping's numbers (23 kinds, 364 secret detectors, 47 behavioural rules, 411 rules) as the app's own: the app's counts come from its engine. Every field is tagged (deck claim, console swagger name, lab reading, lab-invented, measured); a swagger name proves a field exists, not how it behaves.
- Defaults keep the original behaviour (original five kinds, secrets rail off, no rules). New state lives per workspace (sidecar state for kinds and rules, the service for prompt logging) and Reset clears it.
- The server only seals: no decrypt code, a private key (a JWK with `d`) is refused, keys are built from raw bytes (never `generateKeyPair`). The page keeps private keys in memory only.
- Anything typed is masked in every response, error and log (`fold.js`, `mask.js`, `redaction.js`; a test types credential-shaped values into every field of the new endpoints). Errors never echo a pasted key name, pattern or id. Mask before truncating. A pasted regex is checked statically, and V8's linear-time fallback is armed before it is compiled (`rules.js`); no child process, no worker.
- One bad rule refuses the whole paste (400, nothing added); caps refuse the whole request. Every editable field has a test that fails if the field is ignored.
- `docs/talk-track.md` is generated (`scripts/build-talk-track.mjs`): edit `content/talk-track.base.md` or `h2.js`.

## Where the safety claims are pinned

`server/test/safety.test.js` (bind, Host, CSRF, ports, credentials), `netguard.test.js` (zero outbound), `api.test.js`, `sidecar.test.js`, `gateway.test.js` (bounds, inert text, masking, untrusted sidecar), `detectors.test.js`, `scripts/compose.test.mjs` (Docker publish), `scripts/docs.test.mjs` (docs match code), `scripts/k8s.test.mjs` (manifests), `server/test/se-mock.test.js` and `workspaces.test.js` (isolation, cap, TTL), and for the H2 additions `h2-detect.test.js`, `rules.test.js`, `promptlog.test.js`, `h2-api.test.js` and `web/src/H2.test.jsx`. Table: [docs/safety.md](docs/safety.md).

## Shelf and content pack

- Shelf: edit `docs/shelf-entry.json` (tested by `scripts/shelf-entry.test.mjs`); `composeFile` stays a placeholder-style path. Do not edit the shelf repo.
- Content pack: edit `content/terms.json` or `content/stories.json`, run `npm run content-pack`, commit `content-pack.json`. Story text must match the UI (a test checks).

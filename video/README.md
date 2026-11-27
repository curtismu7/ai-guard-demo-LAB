# Video (AI Guard Demo)

The recorded walkthrough shares its wording with the live Story mode: this folder holds the recording
tooling, and `story/captions.md` holds every bubble and slide (served at `GET /api/story`). Edit the
wording there, never here. The standards are `AI-DEMO-Standalone/shared/story/VIDEO.md` (gates,
recording, checks, release) — this README only records what is specific to this lab.

## Files

- `take.py` — the take: opens the lab, plays the walk (13 numbered bubbles, 5 slides), records it.
  Modes: `REHEARSE=1` (fast, stills via `REHEARSE_SHOTS=<dir>`), `SAMPLE=1` (headless preview, labelled
  SAMPLE), `HEADLESS_REAL=1` (the real take, headless). `PROFILE=monitor|laptop`. `SEGMENT=all` (the
  whole walk in one recording; this lab's run is deterministic, so unlike the A2A lab it does not need
  a main/end split — the observability slide standard does not apply here: the demo's own Run log card
  is shown live in the walk instead of a rebuilt slide).
- `guarded_take.py` — wrapper that restarts the lab if it disappears and throws away a half run.
- `captions.py` — loads the wording from the running lab's `/api/story` and refuses stale wording
  (`ALLOW_STALE_WORDING=1` to override — never for a release take).
- `onscreen_mask.py` — the shared on-screen masking (MutationObserver, before paint) and the OCR image
  guard, copied byte-for-byte from the reference lab.
- `take.py`'s `lab_mask_rules` — this lab's own mask rules, built at record time from the lab's `.env`
  (`MASK_ENV`): the sidecar host and port (the only real values the page can name), never written to
  the repo. The page itself shows only mock data (`vk-mock-…` keys, `.invalid` hosts), so the rules are
  few — but a take refuses to run without them.
- `story_bridge.py`, `join.sh`, `test_*.py` — shared overlay bridge, the Air join script, and the tests.

## What the take shows

Opening slide → Sidecar demo tab: a benign run (ALLOW) and a direct-injection run (BLOCK), the
thresholds and the decision log → Agentic Apps tab (name is the route) → Agent Registry tab: the keys,
a permitted call (ALLOWED), a scope-less call (REFUSED, 403 wording) → closing slide.

## Running

```
# rehearse (stills, ~1 min):
REHEARSE=1 SAMPLE=1 REHEARSE_SHOTS=/tmp/shots MASK_ENV=<lab>/.env \
  python3 video/take.py /tmp/rehearse
# read every still, then the sample:
SAMPLE=1 MASK_ENV=<lab>/.env python3 video/take.py /tmp/sample     # → sample.mp4
# the real takes (two cuts, per VIDEO.md):
HEADLESS_REAL=1 PROFILE=monitor MASK_ENV=<lab>/.env python3 video/guarded_take.py <out>/<tag>-monitor
HEADLESS_REAL=1 PROFILE=laptop  MASK_ENV=<lab>/.env python3 video/guarded_take.py <out>/<tag>-laptop
```

Accept a take only when its `result.json` has `ok: true` and `mask_leaks: 0`. The run is deterministic,
but the real classifier (Real mode) can vary: `take.py` retries a contradicting run up to three times
and refuses if it still disagrees. Keep output outside the repo. Frame-review and the release steps are
in `VIDEO.md`; the owner approves both cuts before any release.

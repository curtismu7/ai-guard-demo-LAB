// Story mode (shared pattern: shared/story/README.md in AI-DEMO-Standalone). The wording lives in story/captions.md, the ONE file the live Story reads.
// The shared parser is vendored plain JS (server/src/story/captions.js, pinned by web/src/story/story.sha256); this file is the lab's own glue:
// it reads the file (again whenever it changes), parses it, and answers GET /api/story. Nothing here makes a network call.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseCaptions } from './story/captions.js';

export const CAPTIONS_PATH = fileURLToPath(new URL('../../story/captions.md', import.meta.url));

let cached = null;

// The wording AND the SHA-256 of the exact bytes it was parsed from: one read of the file, so the two can never describe different contents.
// The parse is cached by hash, so an edit shows on the next request (whatever the file's timestamp says) and an unchanged file is not re-parsed.
export function loadCaptionsWithHash(path = CAPTIONS_PATH) {
  const bytes = readFileSync(path);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (path === CAPTIONS_PATH && cached && cached.sha === sha256) return { captions: cached.parsed, sha256 };
  const parsed = parseCaptions(bytes.toString('utf8'));
  if (path === CAPTIONS_PATH) cached = { sha: sha256, parsed };
  return { captions: parsed, sha256 };
}

export const loadCaptions = (path = CAPTIONS_PATH) => loadCaptionsWithHash(path).captions;

// GET /api/story: the wording only, plus the hash of the file it came from. A CaptionsError names itself (so the editor can fix it);
// anything else (a missing file) is logged and never sent, because its text holds the server's paths.
export function storyResponse(path = CAPTIONS_PATH) {
  try { const { captions, sha256 } = loadCaptionsWithHash(path); return { status: 200, body: { ...captions, sourceSha256: sha256 } }; }
  catch (e) {
    if (e instanceof Error && e.name === 'CaptionsError') return { status: 500, body: { error: `Story wording could not be read: ${e.message}` } };
    console.error('story: captions.md could not be read:', e instanceof Error ? e.message : e);
    return { status: 500, body: { error: 'Story wording could not be read: the wording file is missing or unreadable.' } };
  }
}

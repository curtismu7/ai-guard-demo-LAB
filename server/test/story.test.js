// Story parity and pin: the wording (story/captions.md) and the script (web/src/storyScript.js) must agree exactly,
// the opening slide must carry the rule-29 header, and the vendored shared copy must match its pin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { parseCaptions, parity } from '../src/story/captions.js';
import { scriptKeys, STEPS } from '../../web/src/storyScript.js';
import { buildSteps } from '../../web/src/storyWiring.js';

const root = fileURLToPath(new URL('../..', import.meta.url));
const read = (p) => readFileSync(`${root}/${p}`, 'utf8');

test('story: the wording parses and the parity holds both ways', () => {
  const captions = parseCaptions(read('story/captions.md'));
  const problems = parity(captions, scriptKeys());
  assert.deepEqual(problems, []);
});

test('story: the opening slide names the demo (rule 29), and any first-mode slide carries the same header', () => {
  const captions = parseCaptions(read('story/captions.md'));
  assert.ok(captions.opening.header, 'the Opening Slide needs a ## Header');
  const sampleNote = captions.slides.sample_note;
  assert.ok(sampleNote && sampleNote.header, 'sample_note (the Mock first page) exists and carries the header');
});

test('story: the wiring produces engine steps whose keys match the script, in order', () => {
  const steps = buildSteps({ captions: parseCaptions(read('story/captions.md')), host: { mode: () => 'mock', switchTab: () => {} }, doc: {}, win: {} });
  assert.deepEqual(steps.map((s) => s.key), STEPS.map((s) => s.key));
  for (const s of steps) {
    if (s.type === 'bubble') assert.ok(s.target || s.popout || s.prompt, `${s.key}: a bubble needs a target or a prompt`);
  }
});

test('story: the vendored copy matches its pin', async () => {
  const { checkPin } = await import('../../scripts/story-checkPin.mjs');
  assert.deepEqual(checkPin(root), []);
});

test('story: the wording is public-safe (no internal hostnames, ports or key values)', () => {
  const c = read('story/captions.md');
  assert.ok(!/local\.ping-devops\.com|127\.0\.0\.1|vk-mock-[0-9a-f]{6}/.test(c), 'no internal hostnames, ports or mock key values in the wording');
  assert.ok(!/AI-DEMO2/.test(c), 'no AI-DEMO2 references in the wording');
});

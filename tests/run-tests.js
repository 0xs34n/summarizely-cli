#!/usr/bin/env node
// Minimal test runner using Node's assert
const assert = require('assert');

function ok(name, fn) {
  try { fn(); console.log(`✓ ${name}`); }
  catch (e) { console.error(`✗ ${name}:`, e.message); process.exitCode = 1; }
}

// Load built modules
const vtt = require('../dist/vtt.js');
const prompt = require('../dist/prompt.js');
const providers = require('../dist/providers.js');

ok('vtt.parseVttToSegments parses cues', () => {
  const sample = [
    'WEBVTT',
    '',
    '00:00:01.000 --> 00:00:03.000',
    'Hello world',
    '',
    '00:00:03.500 --> 00:00:05.000',
    '<b>Bold</b> text here',
    '',
  ].join('\n');
  const segs = vtt.parseVttToSegments(sample);
  assert.strictEqual(segs.length, 2);
  assert.strictEqual(segs[0].start, 1);
  assert.strictEqual(segs[0].end, 3);
  assert.strictEqual(segs[0].text, 'Hello world');
  assert.strictEqual(segs[1].text, 'Bold text here');
});

ok('prompt.buildPrompt applies maxChars cap with note', () => {
  const cap = {
    title: 'Test',
    url: 'https://youtu.be/abc',
    videoId: 'abc',
    segments: Array.from({ length: 200 }, (_, i) => ({ start: i, end: i + 1, text: 'x'.repeat(1000) })),
  };
  const p = prompt.buildPrompt(cap, cap.videoId, { maxChars: 5000 });
  assert.ok(p.includes('transcript truncated to'));
  assert.ok(p.length <= 9000); // loose upper bound
});

ok('providers.selectProvider picks keys when CLIs absent', () => {
  const env = { OPENAI_API_KEY: 'sk-test' };
  const choice = providers.selectProvider(env);
  assert.strictEqual(choice.provider, 'openai');
});

if (process.exitCode) {
  process.exit(process.exitCode);
}

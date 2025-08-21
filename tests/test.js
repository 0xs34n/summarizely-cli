#!/usr/bin/env node
/**
 * Simple test suite for summarizely-cli
 * Tests only the essential functionality
 */

const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');

// Test counter
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`✗ ${name}: ${e.message}`);
    failed++;
  }
}

// Load the built modules
const utils = require('../dist/utils.js');
const providers = require('../dist/providers.js');
const prompt = require('../dist/prompt.js');
const vtt = require('../dist/vtt.js');

// ============ CORE UTILITIES ============

test('youtubeIdFromUrl extracts video ID', () => {
  assert.strictEqual(utils.youtubeIdFromUrl('https://youtube.com/watch?v=abc123'), 'abc123');
  assert.strictEqual(utils.youtubeIdFromUrl('https://youtu.be/xyz789'), 'xyz789');
  assert.strictEqual(utils.youtubeIdFromUrl('invalid'), null);
});

test('toIsoCompact formats dates correctly', () => {
  const result = utils.toIsoCompact(new Date());
  // Just check format, not exact value
  assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/.test(result));
});

// ============ VTT PARSING ============

test('parseVttToTranscript extracts plain text', () => {
  const vttContent = `WEBVTT

00:00:01.000 --> 00:00:03.000
Hello world

00:00:03.500 --> 00:00:05.000
<b>Bold</b> text here`;
  
  const text = vtt.parseVttToTranscript(vttContent);
  assert.ok(text.includes('Hello world'));
  assert.ok(text.includes('Bold text here'));
  assert.ok(!text.includes('00:00'));
});

// ============ PROVIDERS ============

test('selectProvider returns null when none available', () => {
  const oldPath = process.env.PATH;
  try {
    process.env.PATH = '';
    const choice = providers.selectProvider({});
    assert.strictEqual(choice.provider, null);
  } finally {
    process.env.PATH = oldPath;
  }
});

// ============ PROMPT BUILDING ============

test('buildPrompt truncates long transcripts', () => {
  const caps = {
    title: 'Test Video',
    url: 'https://youtube.com/watch?v=test',
    videoId: 'test',
    transcript: 'x'.repeat(100000)
  };
  const p = prompt.buildPrompt(caps, 'test', { maxChars: 5000 });
  assert.ok(p.includes('transcript truncated'));
  assert.ok(p.length < 10000);
});

// ============ CLI EXECUTION ============

test('CLI shows help', () => {
  const result = spawnSync('node', [path.join(__dirname, '../dist/cli.js'), '--help'], {
    encoding: 'utf8'
  });
  assert.ok(result.stdout.includes('Summarizely CLI'));
  assert.ok(result.stdout.includes('--provider'));
});

test('CLI shows version', () => {
  const result = spawnSync('node', [path.join(__dirname, '../dist/cli.js'), '--version'], {
    encoding: 'utf8'
  });
  assert.ok(result.stdout.includes('.'));
});

test('CLI rejects invalid URLs', () => {
  const result = spawnSync('node', [path.join(__dirname, '../dist/cli.js'), 'not-a-url'], {
    encoding: 'utf8'
  });
  assert.strictEqual(result.status, 2);
  assert.ok(result.stderr.includes('valid YouTube URL'));
});

// ============ SUMMARY ============

console.log('\n' + '='.repeat(40));
console.log(`Tests: ${passed} passed, ${failed} failed`);
console.log('='.repeat(40));

if (failed > 0) {
  process.exit(1);
}
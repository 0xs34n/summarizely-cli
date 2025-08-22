#!/usr/bin/env node

const assert = require('assert');
const vtt = require('../dist/vtt.js');
const prompt = require('../dist/prompt.js');

// Test VTT parsing - the only pure function worth testing
const vttContent = `WEBVTT

00:00:01.000 --> 00:00:03.000
Hello world

00:00:03.500 --> 00:00:05.000
<b>Bold</b> text`;

const text = vtt.parseVttToTranscript(vttContent);
assert(text.includes('Hello world') && text.includes('Bold text'));
assert(!text.includes('00:00'));

// Test prompt truncation - critical for LLM limits
const caps = {
  title: 'Test',
  url: 'https://youtube.com/watch?v=test',
  videoId: 'test',
  transcript: 'x'.repeat(100000)
};
const p = prompt.buildPrompt(caps, 'test', { maxChars: 5000 });
assert(p.includes('transcript truncated'));
assert(p.length < 10000);

console.log('✓ All tests passed');
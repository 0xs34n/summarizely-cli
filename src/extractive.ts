import { Captions, Segment } from './types';
import { secondsToHMS } from './utils';

const STOP = new Set(['the','and','a','an','to','of','in','on','for','is','it','that','this','with','as','at','by','from','or','be','are','was','were','but','we','you','i']);

function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

function scoreSentence(text: string): number {
  const tokens = tokenize(text).filter((t) => !STOP.has(t));
  const unique = new Set(tokens);
  return tokens.length + unique.size * 0.5; // simple heuristic
}

function topNSentences(segments: Segment[], n: number): Segment[] {
  const scored = segments.map((s) => ({ s, score: scoreSentence(s.text) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, n).map((x) => x.s).sort((a, b) => a.start - b.start);
}

export function buildExtractiveMarkdown(cap: Captions): string {
  const { title, url, videoId, segments } = cap;
  const tl = topNSentences(segments, Math.min(5, Math.max(3, Math.floor(segments.length / 60))));
  const lines: string[] = [];
  lines.push(`# ${escapeMd(title)}`);
  lines.push('');
  lines.push(`Source: ${url}`);
  lines.push('');
  lines.push('## TL;DR');
  for (const s of tl) {
    const t = secondsToHMS(s.start);
    const link = `https://youtu.be/${videoId}?t=${Math.floor(s.start)}`;
    lines.push(`- [${t}](${link}): ${escapeMd(inlineTrim(s.text))}`);
  }
  lines.push('');
  lines.push('## Key Points');
  // Sample a point every ~2 minutes for coverage
  const stride = Math.max(1, Math.floor(segments.length / 12));
  for (let i = 0; i < segments.length; i += stride) {
    const s = segments[i];
    const t = secondsToHMS(s.start);
    const link = `https://youtu.be/${videoId}?t=${Math.floor(s.start)}`;
    lines.push(`- [${t}](${link}) ${escapeMd(inlineTrim(s.text))}`);
  }
  lines.push('');
  lines.push('## Quotes');
  for (const s of tl.slice(0, 3)) {
    const t = secondsToHMS(s.start);
    const link = `https://youtu.be/${videoId}?t=${Math.floor(s.start)}`;
    lines.push(`> [${t}](${link}) ${escapeMd(inlineTrim(s.text))}`);
  }
  lines.push('');
  return lines.join('\n');
}

function escapeMd(s: string): string {
  return s.replace(/[<>]/g, '');
}

function inlineTrim(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}


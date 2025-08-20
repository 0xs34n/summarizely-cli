import { Captions } from './types';

export function buildPrompt(cap: Captions, _videoId: string, opts?: { maxChars?: number }): string {
  // Free‑flow, narrative‑first summary prompt
  const metaLines: string[] = [];
  metaLines.push(`# ${cap.title}`);
  metaLines.push('');
  metaLines.push(`**URL:** ${cap.url}  `);
  if (cap.channel) metaLines.push(`**Channel:** ${cap.channel}  `);
  if (cap.published) metaLines.push(`**Published:** ${cap.published}  `);
  if (typeof cap.durationSec === 'number') metaLines.push(`**Duration:** ${formatDuration(cap.durationSec)}  `);
  if (typeof cap.viewCount === 'number') metaLines.push(`**Views:** ${formatCompactNumber(cap.viewCount)}  `);
  if (typeof cap.likeCount === 'number') metaLines.push(`**Likes:** ${formatCompactNumber(cap.likeCount)}  `);
  metaLines.push('**Summary Type:** Full  ');
  metaLines.push(`**Generated:** ${new Date().toISOString()}`);
  metaLines.push('\n---\n');

  const guide = [
    'Write a vivid, free‑flowing Markdown summary that follows the video\'s natural narrative arc from start to finish.',
    'Base everything on the transcript; let the speaker\'s flow lead the structure.',
    '',
    'Guiding style:',
    '- Strong rhythm, succinct sentences, zero filler.',
    '- Chronological by default; compress repeats and tighten rambly bits.',
    '- Creative formatting as needed: micro‑headings, short bullets, callouts, side‑notes, pull quotes, tasteful emojis if they fit.',
    '- Weave in concrete specifics (names, numbers, terms, examples) where they naturally land.',
    '- Bold key phrases to anchor the eye. Do not add timestamps.',
    '- Finish with a brief “Highlights” ribbon and (optional) a tiny “Takeaways” list — keep both punchy.',
    '',
    'Start your answer with this exact metadata block:',
    ...metaLines,
    'Now write the summary.',
  ].join('\n');

  // Collapse whitespace to keep input compact
  let transcript = (cap.transcript || '').replace(/\s+/g, ' ').trim();
  const max = opts?.maxChars ?? Infinity;
  let truncNote = '';
  if (transcript.length > max) {
    transcript = transcript.slice(0, max);
    truncNote = `\n\n(Note: transcript truncated to ${max.toLocaleString()} characters for processing.)`;
  }

  return `Title: ${cap.title}\nURL: ${cap.url}\n\n${guide}${truncNote}\n\nTranscript:\n${transcript}`;
}

// Helper for Claude CLI print mode: returns query (instructions) and body (transcript only)

function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function formatCompactNumber(n: number): string {
  const abs = Math.abs(n);
  const trim = (x: number) => x.toFixed(1).replace(/\.0$/, '');
  if (abs >= 1_000_000_000) return `${trim(n / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (abs >= 1_000) return `${trim(n / 1_000)}K`;
  return Math.round(n).toLocaleString();
}

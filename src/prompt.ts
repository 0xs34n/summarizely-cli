import { Captions } from './types';

export function buildPrompt(cap: Captions, videoId: string): string {
  // User-provided style with safety tweaks
  const guide = [
    'You are summarizing a transcript. Use ONLY the provided text; do not invent facts.',
    'Return Markdown only.',
    'Structure with: 1) TL;DR (3–5 bullets), 2) Key Ideas (short paragraphs), 3) Steps/How‑to, 4) Data/Stats (numbers, names), 5) Quotes (with [hh:mm:ss] links), 6) Open Questions.',
    'Bold important concepts. Include concrete details, numbers, names, and examples.',
    `Use YouTube links: https://youtu.be/${videoId}?t=SECONDS`,
    'Keep it clear and readable; adapt length to content.',
  ].join('\n');

  const transcript = cap.segments
    .map((s) => `${Math.floor(s.start)}\t${s.text.replace(/\s+/g, ' ').trim()}`)
    .join('\n');

  return `Title: ${cap.title}\nURL: ${cap.url}\n\n${guide}\n\nTranscript (seconds\ttext):\n${transcript}`;
}


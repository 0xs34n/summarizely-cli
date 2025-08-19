import { Segment } from './types';

// Minimal VTT parser (supports WEBVTT with cue timestamps)
export function parseVttToSegments(vtt: string): Segment[] {
  const lines = vtt.replace(/\r/g, '').split('\n');
  const segments: Segment[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    i++;
    if (!line) continue;
    // Timestamp line like: 00:00:01.000 --> 00:00:04.000
    if (/^\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}/.test(line)) {
      const [startStr, endStr] = line.split('-->').map((s) => s.trim());
      const start = hmsToSeconds(startStr);
      const end = hmsToSeconds(endStr);
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i]);
        i++;
      }
      const text = textLines.join(' ').replace(/<[^>]+>/g, '').trim();
      if (text) segments.push({ start, end, text });
    }
  }
  return coalesce(segments);
}

function hmsToSeconds(hms: string): number {
  const m = hms.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
  if (!m) return 0;
  const h = parseInt(m[1], 10), mi = parseInt(m[2], 10), s = parseInt(m[3], 10);
  return h * 3600 + mi * 60 + s;
}

function coalesce(segs: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const s of segs) {
    const prev = out[out.length - 1];
    if (prev && s.start - prev.end <= 0.5 && s.text === prev.text) {
      prev.end = s.end;
    } else {
      out.push({ ...s });
    }
  }
  return out;
}


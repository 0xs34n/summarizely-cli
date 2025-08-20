// Minimal VTT parser to plain transcript text (drops timestamps entirely)
export function parseVttToTranscript(vtt: string): string {
  const lines = vtt.replace(/\r/g, '').split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    i++;
    if (!line) continue;
    // Timestamp line like: 00:00:01.000 --> 00:00:04.000
    if (/^\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}/.test(line)) {
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i]);
        i++;
      }
      const text = textLines.join(' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (text) out.push(text);
    }
  }
  // Join as lines to keep some structure without timing
  return out.join('\n');
}

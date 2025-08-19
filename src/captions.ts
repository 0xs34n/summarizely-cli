import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { Captions, Segment } from './types';
import { parseVttToSegments } from './vtt';
import { slugify, tmpDir, youtubeIdFromUrl } from './utils';

export function hasYtDlp(): boolean {
  const r = spawnSync('yt-dlp', ['--version'], { encoding: 'utf8' });
  return r.status === 0;
}

export function getYtDlpInstallHint(): string {
  const platform = process.platform;
  if (platform === 'darwin') return 'brew install yt-dlp';
  if (platform === 'win32') return 'winget install yt-dlp   # or: choco install yt-dlp';
  return 'pipx install yt-dlp   # or: pip install --user yt-dlp';
}

export function fetchCaptions(url: string): Captions | null {
  // Try yt-dlp first
  if (hasYtDlp()) {
    const c = fetchWithYtDlp(url);
    if (c) return c;
  }
  // JS fallback (stub for v1; return null to signal guidance)
  const fb = fetchWithJsFallback(url);
  if (fb) return fb;
  return null;
}

function fetchWithYtDlp(url: string): Captions | null {
  const tmp = tmpDir('summarizely-');
  const base = '%(id)s.%(ext)s';
  const args = [
    '-J', url,
  ];
  const meta = spawnSync('yt-dlp', args, { encoding: 'utf8' });
  if (meta.status !== 0 || !meta.stdout) return null;
  let info: any;
  try { info = JSON.parse(meta.stdout); } catch { return null; }
  const videoId: string = info.id || youtubeIdFromUrl(url) || 'video';
  const title: string = info.title || 'YouTube Video';
  // Pull VTT captions (auto-sub English preferred)
  const subArgs = [
    '--skip-download',
    '--write-auto-sub',
    '--sub-lang', 'en',
    '--sub-format', 'vtt',
    '-o', base,
    url,
  ];
  const r = spawnSync('yt-dlp', subArgs, { cwd: tmp, encoding: 'utf8' });
  if (r.status !== 0) {
    // Try manual-sub if auto-sub failed
    const r2 = spawnSync('yt-dlp', ['--skip-download', '--write-sub', '--sub-lang', 'en', '--sub-format', 'vtt', '-o', base, url], { cwd: tmp, encoding: 'utf8' });
    if (r2.status !== 0) return null;
  }
  // Find VTT file
  const vtts = fs.readdirSync(tmp).filter((f) => f.endsWith('.vtt'));
  if (vtts.length === 0) return null;
  const vttPath = path.join(tmp, vtts[0]);
  const vtt = fs.readFileSync(vttPath, 'utf8');
  const segments: Segment[] = parseVttToSegments(vtt);
  // cleanup temp dir
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  if (!segments.length) return null;
  return { title, videoId, url, segments, vtt };
}

function fetchWithJsFallback(_url: string): Captions | null {
  // Placeholder for v1: require yt-dlp for reliability.
  return null;
}

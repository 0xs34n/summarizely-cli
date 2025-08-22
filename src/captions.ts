import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { Captions, YtDlpInfo } from './types';
import { parseVttToTranscript } from './vtt';
import { tmpDir, youtubeIdFromUrl } from './utils';
import { logStart, logOk, logFail } from './logger';

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
  
  // Single yt-dlp call to get both captions and metadata
  const subArgs = [
    '--skip-download',
    '--write-auto-sub',
    '--write-info-json',  // This writes metadata to a .info.json file
    '--sub-lang', 'en',
    '--sub-format', 'vtt',
    '-o', path.join(tmp, base),
    url,
  ];
  
  logStart('yt-dlp auto-sub');
  const r = spawnSync('yt-dlp', subArgs, { encoding: 'utf8' });
  if (r.status !== 0) {
    logFail('yt-dlp auto-sub', `exit code: ${r.status}`);
    // Try manual-sub if auto-sub failed
    logStart('yt-dlp manual-sub');
    const r2 = spawnSync('yt-dlp', [
      '--skip-download',
      '--write-sub',
      '--write-info-json',
      '--sub-lang', 'en',
      '--sub-format', 'vtt',
      '-o', path.join(tmp, base),
      url
    ], { encoding: 'utf8' });
    if (r2.status !== 0) {
      logFail('yt-dlp manual-sub', `exit code: ${r2.status}`);
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
      return null;
    }
    logOk('yt-dlp manual-sub');
  } else {
    logOk('yt-dlp auto-sub');
  }
  
  // Find and parse the info.json file
  const jsonFiles = fs.readdirSync(tmp).filter((f) => f.endsWith('.info.json'));
  if (jsonFiles.length === 0) {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
    return null;
  }
  
  const jsonPath = path.join(tmp, jsonFiles[0]);
  let info: YtDlpInfo;
  try {
    const jsonContent = fs.readFileSync(jsonPath, 'utf8');
    info = JSON.parse(jsonContent) as YtDlpInfo;
  } catch {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
    return null;
  }
  
  // Extract metadata from the info.json file
  const videoId: string = info.id || youtubeIdFromUrl(url) || 'video';
  const title: string = info.title || 'YouTube Video';
  const channel: string | undefined = info.channel || info.uploader || undefined;
  const channelId: string | undefined = info.channel_id || info.uploader_id || undefined;
  const durationSec: number | undefined = typeof info.duration === 'number' ? info.duration : undefined;
  const viewCount: number | undefined = typeof info.view_count === 'number' ? info.view_count : undefined;
  const likeCount: number | undefined = typeof info.like_count === 'number' ? info.like_count : undefined;
  const commentCount: number | undefined = typeof info.comment_count === 'number' ? info.comment_count : undefined;
  const averageRating: number | undefined = typeof info.average_rating === 'number' ? info.average_rating : undefined;
  
  // upload_date from yt-dlp is YYYYMMDD; convert to ISO date (YYYY-MM-DD) when present
  let published: string | undefined;
  if (typeof info.upload_date === 'string' && /^(\d{8})$/.test(info.upload_date)) {
    const y = info.upload_date.slice(0, 4);
    const m = info.upload_date.slice(4, 6);
    const d = info.upload_date.slice(6, 8);
    published = `${y}-${m}-${d}`;
  }
  
  // Find VTT file
  const vtts = fs.readdirSync(tmp).filter((f) => f.endsWith('.vtt'));
  if (vtts.length === 0) {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
    return null;
  }
  
  const vttPath = path.join(tmp, vtts[0]);
  const vtt = fs.readFileSync(vttPath, 'utf8');
  const transcript: string = parseVttToTranscript(vtt);
  
  // cleanup temp dir
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  
  if (!transcript.trim()) return null;
  return { title, videoId, url, transcript, vtt, channel, channelId, durationSec, published, viewCount, likeCount, commentCount, averageRating };
}

function fetchWithJsFallback(_url: string): Captions | null {
  // Placeholder for v1: require yt-dlp for reliability.
  return null;
}

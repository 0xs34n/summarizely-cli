import fs from 'fs';
import path from 'path';
import os from 'os';

export function isWindows() { return process.platform === 'win32'; }
export function isMac() { return process.platform === 'darwin'; }

export function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

export function toIsoCompact(d: Date = new Date()): string {
  // YYYY-MM-DDTHH-mm-ssZ
  return d.toISOString().replace(/:/g, '-');
}

export function secondsToHMS(s: number): string {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, '0')).join(':');
}

export function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export function writeLatestCopy(dir: string, targetPath: string) {
  const latest = path.join(dir, 'latest.md');
  try {
    // Symlink if supported; else copy
    try {
      if (fs.existsSync(latest)) fs.unlinkSync(latest);
      fs.symlinkSync(path.basename(targetPath), latest);
      return;
    } catch {
      // fallback copy
    }
    fs.copyFileSync(targetPath, latest);
  } catch {
    // ignore
  }
}

export function tmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function youtubeIdFromUrl(u: string): string | null {
  try {
    const url = new URL(u);
    if (url.hostname === 'youtu.be') return url.pathname.slice(1) || null;
    if (/(^|\.)youtube\.com$/.test(url.hostname)) {
      const v = url.searchParams.get('v');
      return v || null;
    }
    return null;
  } catch {
    return null;
  }
}


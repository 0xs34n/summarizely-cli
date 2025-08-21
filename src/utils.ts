import fs from 'fs';
import path from 'path';
import os from 'os';

export function toIsoCompact(d: Date = new Date()): string {
  // YYYY-MM-DDTHH-mm-ssZ
  return d.toISOString().replace(/:/g, '-');
}

export function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export function writeToLatestDir(outputDir: string, files: { source: string; name: string }[]): void {
  try {
    const latestDir = path.join(outputDir, '_latest');
    // Clean and recreate the _latest directory
    try { fs.rmSync(latestDir, { recursive: true, force: true }); } catch {}
    ensureDir(latestDir);
    
    // Copy all specified files
    for (const file of files) {
      try {
        fs.copyFileSync(file.source, path.join(latestDir, file.name));
      } catch {
        // Individual file copy failures don't stop the process
      }
    }
  } catch {
    // Failing to update _latest is not critical
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
      // Check for watch?v= format
      const v = url.searchParams.get('v');
      if (v) return v;
      
      // Check for /embed/ format
      if (url.pathname.startsWith('/embed/')) {
        const id = url.pathname.slice(7).split('/')[0];
        return id || null;
      }
      
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

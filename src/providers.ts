import { Captions, Provider } from './types';
import { spawn } from 'child_process';

export type ProviderChoice = {
  provider: Provider | null;
  reason: string;
};

export function selectProvider(env = process.env): ProviderChoice {
  // Prefer local CLI providers if present; then local Ollama; then cloud keys
  if (hasCli('claude')) return { provider: 'claude-cli', reason: 'Claude CLI detected' };
  if (hasCli('codex')) return { provider: 'codex-cli', reason: 'Codex CLI detected' };
  if (env.OLLAMA_HOST || hasOllamaCli()) return { provider: 'ollama', reason: 'Ollama detected' };
  if (env.OPENAI_API_KEY) return { provider: 'openai', reason: 'OPENAI_API_KEY found' };
  if (env.ANTHROPIC_API_KEY) return { provider: 'anthropic', reason: 'ANTHROPIC_API_KEY found' };
  if (env.GOOGLE_API_KEY) return { provider: 'google', reason: 'GOOGLE_API_KEY found' };
  return { provider: null, reason: 'No local model or API keys detected' };
}

function hasOllamaCli(): boolean {
  try {
    const { spawnSync } = require('child_process');
    const r = spawnSync('ollama', ['--version'], { encoding: 'utf8' });
    return r.status === 0;
  } catch { return false; }
}

function hasCli(bin: string): boolean {
  try {
    const { spawnSync } = require('child_process');
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    const r = spawnSync(cmd, [bin], { encoding: 'utf8' });
    return r.status === 0;
  } catch { return false; }
}

export async function summarizeWithProvider(provider: Provider, _cap: Captions, prompt: string): Promise<string | null> {
  if (provider === 'claude-cli') {
    return runCliCapture('claude', [], prompt, 5 * 60_000);
  }
  if (provider === 'codex-cli') {
    return runCliCapture('codex', ['exec'], prompt, 5 * 60_000);
  }
  // Other providers not implemented in v1
  return null;
}

function runCliCapture(cmd: string, args: string[], input: string, timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
      let out = '';
      let err = '';
      const t = setTimeout(() => {
        child.kill('SIGTERM');
      }, timeoutMs);
      child.stdout.on('data', (d) => { out += d.toString(); });
      child.stderr.on('data', (d) => { err += d.toString(); });
      child.on('close', (code) => {
        clearTimeout(t);
        if (code === 0 && out.trim().length > 0) resolve(out.trim());
        else resolve(null);
      });
      child.on('error', () => resolve(null));
      child.stdin.write(input);
      child.stdin.end();
    } catch {
      resolve(null);
    }
  });
}

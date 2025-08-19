import { Captions, Provider } from './types';
import { spawn } from 'child_process';
import http from 'http';
import https from 'https';
import { URL } from 'url';

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

export async function summarizeWithProvider(provider: Provider, _cap: Captions, prompt: string, opts?: { model?: string }): Promise<string | null> {
  if (provider === 'claude-cli') {
    return runCliCapture('claude', [], prompt, 5 * 60_000);
  }
  if (provider === 'codex-cli') {
    return runCliCapture('codex', ['exec'], prompt, 5 * 60_000);
  }
  if (provider === 'ollama') {
    try {
      const host = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
      const model = opts?.model || (await selectOllamaModel(host));
      if (!model) return null;
      const text = await ollamaGenerate(host, model, prompt, {
        temperature: 0.2,
        top_p: 0.9,
        top_k: 40,
        timeoutMs: 3 * 60_000,
      });
      return text || null;
    } catch {
      return null;
    }
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

// ---- Ollama helpers ----
type OllamaModel = { name: string; size?: number };

async function selectOllamaModel(host: string): Promise<string | null> {
  // Respect preference for qwen2.5:0.5b-instruct if present; else pick smallest instruct model
  const models = await listOllamaModels(host);
  if (!models.length) return null;
  const qwen = models.find((m) => /qwen/i.test(m.name) && /0\.5b/i.test(m.name) && /instruct/i.test(m.name));
  if (qwen) return qwen.name;
  const instruct = models.filter((m) => /instruct/i.test(m.name));
  if (instruct.length === 0) return models[0].name;
  instruct.sort((a, b) => (a.size ?? Number.MAX_SAFE_INTEGER) - (b.size ?? Number.MAX_SAFE_INTEGER));
  return instruct[0].name;
}

async function listOllamaModels(host: string): Promise<OllamaModel[]> {
  try {
    const data = await httpRequest(host + '/api/tags', { method: 'GET' }, undefined, 5000);
    const json = JSON.parse(data || '{}');
    const arr = Array.isArray(json.models) ? json.models : [];
    return arr.map((m: any) => ({ name: m?.name, size: m?.size })).filter((m: any) => typeof m.name === 'string');
  } catch {
    return [];
  }
}

async function ollamaGenerate(host: string, model: string, prompt: string, opts: { temperature?: number; top_p?: number; top_k?: number; timeoutMs?: number }): Promise<string> {
  const body = {
    model,
    prompt,
    stream: false,
    options: {
      temperature: opts.temperature,
      top_p: opts.top_p,
      top_k: opts.top_k,
    },
  };
  const res = await httpRequest(host + '/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' } }, JSON.stringify(body), opts.timeoutMs ?? 180000);
  const json = JSON.parse(res || '{}');
  return json?.response ?? '';
}

function httpRequest(urlStr: string, options: { method?: string; headers?: Record<string, string> }, body?: string, timeoutMs: number = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(urlStr);
      const mod = u.protocol === 'https:' ? https : http;
      const req = mod.request(
        {
          protocol: u.protocol,
          hostname: u.hostname,
          port: u.port,
          path: u.pathname + (u.search || ''),
          method: options.method || 'GET',
          headers: options.headers || {},
        },
        (res) => {
          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) resolve(data);
            else reject(new Error(`HTTP ${res.statusCode}`));
          });
        }
      );
      req.on('error', reject);
      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error('timeout'));
      });
      if (body) req.write(body);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

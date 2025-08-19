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

export class ProviderError extends Error {
  code:
    | 'unavailable'
    | 'timeout'
    | 'auth'
    | 'rate_limit'
    | 'invalid_request'
    | 'not_found'
    | 'no_models'
    | 'unknown';
  constructor(code: ProviderError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

export async function summarizeWithProvider(
  provider: Provider,
  _cap: Captions,
  prompt: string,
  opts?: { model?: string }
): Promise<string | null> {
  if (provider === 'claude-cli') {
    return runCliCapture('claude', [], prompt, 5 * 60_000);
  }
  if (provider === 'codex-cli') {
    return runCliCapture('codex', ['exec'], prompt, 5 * 60_000);
  }
  if (provider === 'openai') {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new ProviderError('auth', 'OPENAI_API_KEY is not set');
      const model = opts?.model || 'gpt-4o-mini';
      const text = await openaiChat(prompt, model, apiKey, { timeoutMs: 120_000, temperature: 0.2 });
      return text || null;
    } catch (e: any) {
      if (e instanceof ProviderError) throw e;
      throw new ProviderError('unknown', e?.message || 'OpenAI error');
    }
  }
  if (provider === 'anthropic') {
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new ProviderError('auth', 'ANTHROPIC_API_KEY is not set');
      const model = (opts?.model as string) || 'claude-3-5-sonnet-latest';
      const text = await anthropicMessages(prompt, model, apiKey, { timeoutMs: 120_000, temperature: 0.2 });
      return text || null;
    } catch (e: any) {
      if (e instanceof ProviderError) throw e;
      throw new ProviderError('unknown', e?.message || 'Anthropic error');
    }
  }
  if (provider === 'ollama') {
    try {
      const host = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
      const model = opts?.model || (await selectOllamaModel(host));
      if (!model) throw new ProviderError('no_models', 'No Ollama models installed');
      const text = await ollamaGenerate(host, model, prompt, {
        temperature: 0.2,
        top_p: 0.9,
        top_k: 40,
        timeoutMs: 3 * 60_000,
      });
      return text || null;
    } catch (e: any) {
      if (e instanceof ProviderError) throw e;
      throw new ProviderError('unavailable', e?.message || 'Ollama unavailable');
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
      child.on('error', (error: any) => {
        if (error && error.code === 'ENOENT') {
          throw new ProviderError('not_found', `${cmd} CLI not found on PATH`);
        }
        resolve(null);
      });
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
  } catch (e: any) {
    throw new ProviderError('unavailable', `Cannot reach Ollama at ${host}`);
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
  const res = await httpRequest(
    host + '/api/generate',
    { method: 'POST', headers: { 'content-type': 'application/json' } },
    JSON.stringify(body),
    opts.timeoutMs ?? 180000
  );
  const json = JSON.parse(res || '{}');
  return json?.response ?? '';
}

class HttpError extends Error { status?: number; constructor(status?: number, message?: string) { super(message); this.status = status; } }

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
            else reject(new HttpError(res.statusCode, `HTTP ${res.statusCode}`));
          });
        }
      );
      req.on('error', (e) => reject(e));
      req.setTimeout(timeoutMs, () => {
        req.destroy(new HttpError(undefined, 'timeout'));
      });
      if (body) req.write(body);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

// ---- Streaming variants ----
export async function summarizeWithProviderStream(
  provider: Provider,
  _cap: Captions,
  prompt: string,
  opts: { model?: string; onChunk: (chunk: string) => void }
): Promise<string | null> {
  if (provider === 'claude-cli') {
    return runCliStream('claude', [], prompt, 5 * 60_000, opts.onChunk);
  }
  if (provider === 'codex-cli') {
    return runCliStream('codex', ['exec'], prompt, 5 * 60_000, opts.onChunk);
  }
  if (provider === 'ollama') {
    try {
      const host = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
      const model = opts?.model || (await selectOllamaModel(host));
      if (!model) return null;
      return await ollamaGenerateStream(host, model, prompt, {
        temperature: 0.2,
        top_p: 0.9,
        top_k: 40,
        timeoutMs: 3 * 60_000,
        onChunk: opts.onChunk,
      });
    } catch {
      return null;
    }
  }
  return null;
}

function runCliStream(
  cmd: string,
  args: string[],
  input: string,
  timeoutMs: number,
  onChunk: (chunk: string) => void
): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
      let out = '';
      let err = '';
      const t = setTimeout(() => {
        child.kill('SIGTERM');
      }, timeoutMs);
      child.stdout.on('data', (d) => {
        const s = d.toString();
        out += s;
        onChunk(s);
      });
      child.stderr.on('data', (d) => {
        err += d.toString();
      });
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

async function ollamaGenerateStream(
  host: string,
  model: string,
  prompt: string,
  opts: { temperature?: number; top_p?: number; top_k?: number; timeoutMs?: number; onChunk: (chunk: string) => void }
): Promise<string> {
  const body = {
    model,
    prompt,
    stream: true,
    options: {
      temperature: opts.temperature,
      top_p: opts.top_p,
      top_k: opts.top_k,
    },
  };
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(host + '/api/generate');
      const mod = u.protocol === 'https:' ? https : http;
      const req = mod.request(
        {
          protocol: u.protocol,
          hostname: u.hostname,
          port: u.port,
          path: u.pathname + (u.search || ''),
          method: 'POST',
          headers: { 'content-type': 'application/json' },
        },
        (res) => {
          let buf = '';
          let acc = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            buf += chunk;
            let idx;
            while ((idx = buf.indexOf('\n')) >= 0) {
              const line = buf.slice(0, idx).trim();
              buf = buf.slice(idx + 1);
              if (!line) continue;
              try {
                const obj = JSON.parse(line);
                if (typeof obj?.response === 'string' && obj.response.length > 0) {
                  opts.onChunk(obj.response);
                  acc += obj.response;
                }
                if (obj?.done) {
                  resolve(acc);
                }
              } catch {
                // ignore parse errors for partial lines
              }
            }
          });
          res.on('end', () => {
            // If server ended without done, resolve whatever we have
            resolve(acc);
          });
        }
      );
      req.on('error', reject);
      req.setTimeout(opts.timeoutMs ?? 180000, () => {
        req.destroy(new Error('timeout'));
      });
      req.write(JSON.stringify(body));
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

// ---- OpenAI helpers ----
async function openaiChat(
  prompt: string,
  model: string,
  apiKey: string,
  opts: { timeoutMs?: number; temperature?: number }
): Promise<string> {
  const body = {
    model,
    temperature: opts.temperature ?? 0.2,
    messages: [
      { role: 'system', content: 'Return Markdown only. Use only the provided transcript. No fabrication.' },
      { role: 'user', content: prompt },
    ],
  } as any;
  let res: string;
  try {
    res = await httpRequest(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${apiKey}`,
        },
      },
      JSON.stringify(body),
      opts.timeoutMs ?? 120000
    );
  } catch (e: any) {
    if (e instanceof HttpError) {
      if (e.status === 401 || e.status === 403) throw new ProviderError('auth', 'OpenAI authentication failed');
      if (e.status === 429) throw new ProviderError('rate_limit', 'OpenAI rate limit exceeded');
      if (e.status && e.status >= 400 && e.status < 500) throw new ProviderError('invalid_request', 'OpenAI invalid request');
      if (e.status && e.status >= 500) throw new ProviderError('unavailable', 'OpenAI server error');
    }
    if (e?.message === 'timeout') throw new ProviderError('timeout', 'OpenAI request timed out');
    throw e;
  }
  const json = JSON.parse(res || '{}');
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  return '';
}

// ---- Anthropic (Claude) helpers ----
export async function anthropicMessages(
  prompt: string,
  model: string,
  apiKey: string,
  opts: { timeoutMs?: number; temperature?: number }
): Promise<string> {
  let res: string;
  try {
    const body = {
      model,
      max_tokens: 2000,
      temperature: opts.temperature ?? 0.2,
      system: 'Return Markdown only. Use only the provided transcript. No fabrication.',
      messages: [ { role: 'user', content: prompt } ],
    };
    res = await httpRequest(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      },
      JSON.stringify(body),
      opts.timeoutMs ?? 120000
    );
  } catch (e: any) {
    if (e instanceof HttpError) {
      if (e.status === 401 || e.status === 403) throw new ProviderError('auth', 'Anthropic authentication failed');
      if (e.status === 429) throw new ProviderError('rate_limit', 'Anthropic rate limit exceeded');
      if (e.status && e.status >= 400 && e.status < 500) throw new ProviderError('invalid_request', 'Anthropic invalid request');
      if (e.status && e.status >= 500) throw new ProviderError('unavailable', 'Anthropic server error');
    }
    if (e?.message === 'timeout') throw new ProviderError('timeout', 'Anthropic request timed out');
    throw e;
  }
  const json = JSON.parse(res || '{}');
  const content = Array.isArray(json?.content) ? json.content.map((p: any) => p?.text || '').join('') : '';
  return content || '';
}

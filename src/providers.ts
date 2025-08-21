import { Captions, Provider } from './types';
import { spawn, spawnSync } from 'child_process';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import fs from 'fs';

export type ProviderChoice = {
  provider: Provider | null;
  reason: string;
};

export function selectProvider(env = process.env): ProviderChoice {
  // Prefer local CLI providers if present; then local Ollama
  if (hasCli('claude')) return { provider: 'claude-cli', reason: 'Claude CLI detected' };
  if (hasCli('codex')) return { provider: 'codex-cli', reason: 'Codex CLI detected' };
  if (env.OLLAMA_HOST || hasOllamaCli()) return { provider: 'ollama', reason: 'Ollama detected' };
  return { provider: null, reason: 'No CLI tools or local models detected' };
}

function hasOllamaCli(): boolean {
  try {
    const r = spawnSync('ollama', ['--version'], { encoding: 'utf8' });
    return r.status === 0;
  } catch { return false; }
}

function hasCli(bin: string): boolean {
  try {
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
    return runClaudePrintFlagCapture(prompt, 5 * 60_000);
  }
  if (provider === 'codex-cli') {
    const rawOutput = await runCliCapture('codex', ['exec'], prompt, 5 * 60_000);
    return extractMarkdownFromCodexOutput(rawOutput);
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

export function extractMarkdownFromCodexOutput(output: string | null): string | null {
  if (!output) return null;
  
  const lines = output.split('\n');
  let actualSummaryStart = -1;
  let foundCodexMarker = false;
  
  // Look for the [timestamp] codex marker followed by actual markdown summary
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this line contains a codex timestamp marker
    if (line.includes('] codex')) {
      foundCodexMarker = true;
      continue;
    }
    
    // After finding codex marker, look for the actual summary start
    if (foundCodexMarker && line.trim().startsWith('#') && line.trim().length > 1) {
      actualSummaryStart = i;
      break;
    }
  }
  
  if (actualSummaryStart !== -1) {
    // Found the actual summary after codex marker
    return lines.slice(actualSummaryStart).join('\n').trim();
  }
  
  // Fallback: look for a line that starts with # followed by proper metadata
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#') && !line.includes('Now write the summary') && line.length > 1) {
      // Check if next few lines contain URL metadata
      const nextLines = lines.slice(i, Math.min(i + 10, lines.length)).join('\n');
      if (nextLines.includes('**URL:**') && nextLines.includes('**Generated:**')) {
        return lines.slice(i).join('\n').trim();
      }
    }
  }
  
  // If no clear summary found, return original
  return output;
}

function runCliCapture(cmd: string, args: string[], input: string, timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const realArgs = (cmd === 'claude' && args.length === 0) ? ['code'] : args;
      const child = spawn(cmd, realArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
      let out = '';
      let err = '';
      const t = setTimeout(() => {
        child.kill('SIGTERM');
      }, timeoutMs);
      child.stdout.on('data', (d) => { out += d.toString(); });
      child.stderr.on('data', (d) => { const s = d.toString(); err += s; process.stderr.write(`[provider ${cmd}] ${s}`); });
      child.on('close', (code) => {
        clearTimeout(t);
        if (code === 0 && out.trim().length > 0) resolve(out.trim());
        else resolve(null);
      });
      child.on('error', (error: any) => {
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
  // Pick smallest instruct model, or smallest model overall
  const models = await listOllamaModels(host);
  if (!models.length) return null;
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
  const url = host + '/api/generate';
  const doReq = () => httpRequest(
    url,
    { method: 'POST', headers: { 'content-type': 'application/json' } },
    JSON.stringify(body),
    opts.timeoutMs ?? 180000
  );
  let res: string;
  try {
    res = await doReq();
  } catch (e: any) {
    // Transient retry: timeout or 5xx once
    const isTransient = (e && (e.message === 'timeout' || (typeof e.status === 'number' && e.status >= 500)));
    if (!isTransient) throw e;
    res = await doReq();
  }
  const json = JSON.parse(res || '{}');
  return json?.response ?? '';
}

class HttpError extends Error { status?: number; constructor(status?: number, message?: string) { super(message); this.status = status; } }

function _httpRequestImpl(urlStr: string, options: { method?: string; headers?: Record<string, string> }, body?: string, timeoutMs: number = 10000): Promise<string> {
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

// Test hook: allow overriding http requester
export let httpRequest = _httpRequestImpl;
export function __setHttpRequest(fn: typeof _httpRequestImpl) { httpRequest = fn; }

// Minimal Claude print-mode helpers: pass entire prompt via -p to avoid stdin EPIPE
function runClaudePrintFlagCapture(prompt: string, timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const child = spawn('claude', ['-p', prompt], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      let err = '';
      const t = setTimeout(() => { child.kill('SIGTERM'); }, timeoutMs);
      child.stdout.on('data', (d) => { out += d.toString(); });
      child.stderr.on('data', (d) => { err += d.toString(); });
      child.on('close', (code) => {
        clearTimeout(t);
        if (code === 0 && out.trim().length > 0) {
          const output = out.trim();
          // Check if Claude Code created a file instead of outputting the summary
          const fileMatch = output.match(/^Summary created at `(.+?)`$/);
          if (fileMatch && fileMatch[1]) {
            try {
              // Read the actual summary from the file Claude Code created
              const content = fs.readFileSync(fileMatch[1], 'utf8');
              // Clean up the temporary file
              fs.unlinkSync(fileMatch[1]);
              resolve(content);
            } catch {
              // If we can't read the file, fall back to the original output
              resolve(output);
            }
          } else {
            resolve(output);
          }
        }
        else resolve(null);
      });
      child.on('error', () => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

// Friendly error message mapper for CLI
export function formatProviderError(provider: string, e: ProviderError): string {
  if (provider === 'ollama') {
    if (e.code === 'no_models') return 'Ollama has no models installed. Try: ollama pull llama3.2:1b';
    if (e.code === 'unavailable') return `Cannot reach Ollama at ${process.env.OLLAMA_HOST || 'http://127.0.0.1:11434'}. Is it running?`;
    if (e.code === 'timeout') return 'Ollama request timed out.';
  }
  if (provider === 'claude-cli' || provider === 'codex-cli') {
    if (e.code === 'not_found') return `${provider === 'claude-cli' ? 'Claude' : 'Codex'} CLI not found on PATH.`;
  }
  return `Provider error (${provider}): ${e.message}`;
}

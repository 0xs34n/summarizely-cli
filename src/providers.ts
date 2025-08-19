import { Captions, Provider } from './types';

export type ProviderChoice = {
  provider: Provider | null;
  reason: string;
};

export function selectProvider(env = process.env): ProviderChoice {
  // Prefer local Ollama if reachable via env hint; otherwise pick first cloud with a key
  if (env.OLLAMA_HOST || hasOllamaCli()) {
    return { provider: 'ollama', reason: 'Ollama detected' };
  }
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

export async function summarizeWithProvider(_provider: Provider, _cap: Captions, _prompt: string): Promise<string | null> {
  // v1: Keep simple and rely on extractive fallback unless explicitly configured later.
  return null;
}


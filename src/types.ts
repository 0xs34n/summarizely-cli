export type Segment = {
  start: number; // seconds
  end: number;   // seconds
  text: string;
};

export type Captions = {
  title: string;
  videoId: string;
  url: string;
  segments: Segment[];
};

export type Provider = 'claude-cli' | 'codex-cli' | 'ollama' | 'openai' | 'anthropic' | 'google';

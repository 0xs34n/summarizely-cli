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

export type Provider = 'ollama' | 'openai' | 'anthropic' | 'google';


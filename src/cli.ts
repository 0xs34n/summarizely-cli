#!/usr/bin/env node
/*
  Summarizely CLI — scaffold
  Usage: summarizely <youtube-url> [--model <name>] [--captions-only] [--json]
*/

type Args = {
  url?: string;
  provider?: string;
  model?: string;
  captionsOnly?: boolean;
  json?: boolean;
  outputDir?: string;
  noSaveTranscript?: boolean;
  maxChars?: number;
  noCap?: boolean;
  help?: boolean;
  version?: boolean;
};

// Minimal arg parser (no deps)
function parseArgs(argv: string[]): Args {
  const args: Args = {};
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--version" || a === "-v") args.version = true;
    else if (a === "--captions-only") args.captionsOnly = true;
    else if (a === "--json") args.json = true;
    else if (a === "--model") {
      args.model = argv[++i];
    } else if (a === "--provider") {
      args.provider = argv[++i];
    } else if (a === "--output-dir") {
      args.outputDir = argv[++i];
    } else if (a === "--no-save-transcript") {
      args.noSaveTranscript = true;
    } else if (a === "--max-chars") {
      const v = argv[++i];
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) throw new Error("--max-chars requires a positive number");
      args.maxChars = n;
    } else if (a === "--no-cap") {
      args.noCap = true;
    } else {
      rest.push(a);
    }
  }
  if (rest[0] && !args.url) args.url = rest[0];
  return args;
}

function printHelp() {
  const msg = `\nSummarizely CLI\n\nUsage:\n  summarizely <youtube-url> [options]\n\nOptions:\n  -h, --help               Show help\n  -v, --version            Show version\n      --provider <name>    Provider: claude-cli|codex-cli|ollama|openai|anthropic|google\n      --model <name>       Model preset (default: qwen2.5:0.5b-instruct for Ollama)\n      --captions-only      Force captions-only (no ASR; v1 doesn\'t do ASR)\n      --output-dir <dir>   Output directory (default: summaries)\n      --no-save-transcript Do not write transcript .vtt/.txt files next to summary\n      --max-chars <n>      Max transcript chars for CLI providers (default ~80k)\n      --no-cap             Disable transcript cap for CLI providers\n      --json               Output JSON (metadata + content)\n`;
  process.stdout.write(msg);
}

function getVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require("../package.json");
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function isYouTubeUrl(u?: string): boolean {
  if (!u) return false;
  try {
    const url = new URL(u);
    return /(^|\.)youtube\.com$/.test(url.hostname) || url.hostname === "youtu.be";
  } catch {
    return false;
  }
}

import { ensureDir, slugify, toIsoCompact, youtubeIdFromUrl, writeLatestCopy } from './utils';
import { fetchCaptions, getYtDlpInstallHint, hasYtDlp } from './captions';
import { buildExtractiveMarkdown } from './extractive';
import { selectProvider, summarizeWithProvider } from './providers';
import { buildPrompt } from './prompt';
import path from 'path';
import fs from 'fs';

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);

  if (args.help) return printHelp();
  if (args.version) return process.stdout.write(getVersion() + "\n");

  if (!isYouTubeUrl(args.url)) {
    printHelp();
    process.stderr.write("\nError: please provide a valid YouTube URL.\n");
    process.exitCode = 2;
    return;
  }

  const url = args.url!;
  const vid = youtubeIdFromUrl(url);
  const outputDir = args.outputDir || 'summaries';

  // Fetch captions (yt-dlp preferred)
  const caps = fetchCaptions(url);
  if (!caps) {
    const lines: string[] = [];
    lines.push('Captions not available.');
    if (!hasYtDlp()) {
      lines.push('Tip: Install yt-dlp for best results:');
      lines.push('  ' + getYtDlpInstallHint());
    }
    process.stderr.write(lines.join('\n') + '\n');
    process.exitCode = 4;
    return;
  }

  // Provider routing (v1 falls back to extractive if none configured)
  const choice = selectProvider(process.env);
  let markdown: string | null = null;
  if (args.provider) {
    choice.provider = args.provider as any;
  }
  if (choice.provider) {
    const isCliProvider = choice.provider === 'claude-cli' || choice.provider === 'codex-cli';
    const maxChars = isCliProvider && !args.noCap ? (args.maxChars ?? 80000) : undefined;
    const prompt = buildPrompt(caps, vid || caps.videoId, maxChars ? { maxChars } : undefined);
    markdown = await summarizeWithProvider(choice.provider, caps, prompt);
  }
  if (!markdown) {
    markdown = buildExtractiveMarkdown(caps);
  }

  // Output writing
  ensureDir(outputDir);
  const ts = toIsoCompact(new Date());
  const slug = slugify(caps.title || vid || 'video');
  const fname = `${ts}-${caps.videoId}-${slug}.md`;
  const fpath = path.join(outputDir, fname);
  fs.writeFileSync(fpath, markdown, 'utf8');
  writeLatestCopy(outputDir, fpath);
  if (!args.noSaveTranscript) {
    const base = fpath.replace(/\.md$/i, '');
    try {
      if ((caps as any).vtt) fs.writeFileSync(base + '-transcript.vtt', (caps as any).vtt, 'utf8');
    } catch {}
    try {
      const { segmentsToPlainText } = await import('./utils');
      const plain = segmentsToPlainText(caps.segments);
      fs.writeFileSync(base + '-transcript.txt', plain, 'utf8');
    } catch {}
  }

  if (args.json) {
    process.stdout.write(JSON.stringify({
      status: 'ok',
      path: fpath,
      provider: choice.provider,
      url,
      videoId: caps.videoId,
      title: caps.title,
    }, null, 2) + '\n');
  } else {
    process.stdout.write(markdown + '\n');
  }
}

main().catch((err) => {
  process.stderr.write(`Unexpected error: ${err?.message || err}\n`);
  process.exitCode = 1;
});

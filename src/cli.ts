#!/usr/bin/env node
/*
  Summarizely CLI — scaffold
  Usage: summarizely <youtube-url> [--model <name>] [--captions-only]
*/

import { ensureDir, toIsoCompact, youtubeIdFromUrl, writeToLatestDir } from './utils';
import { fetchCaptions, getYtDlpInstallHint, hasYtDlp } from './captions';
import { selectProvider, summarizeWithProvider, ProviderError, formatProviderError } from './providers';
import { buildPrompt } from './prompt';
// Removed caching and retry modules for simplicity
import path from 'path';
import fs from 'fs';

type Args = {
  url?: string;
  provider?: string;
  model?: string;
  outputDir?: string;
  noSaveTranscript?: boolean;
  maxChars?: number;
  noCap?: boolean;
  help?: boolean;
  version?: boolean;
};

// Helper to validate required argument
function requireValue(flag: string, i: number, argv: string[]): string {
  if (i + 1 >= argv.length || String(argv[i + 1]).startsWith('-')) {
    throw new Error(`${flag} requires a value`);
  }
  return argv[i + 1];
}

// Minimal arg parser (no deps)
function parseArgs(argv: string[]): Args {
  const args: Args = {};
  const rest: string[] = [];
  
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    
    // Flags
    if (a === "--help" || a === "-h") {
      args.help = true;
    } else if (a === "--version" || a === "-v") {
      args.version = true;
    } else if (a === "--no-save-transcript") {
      args.noSaveTranscript = true;
    } else if (a === "--no-cap") {
      args.noCap = true;
    }
    // Arguments with values
    else if (a === "--model" || a === "-m") {
      args.model = requireValue(a, i, argv);
      i++;
    } else if (a === "--provider" || a === "-p") {
      args.provider = requireValue(a, i, argv);
      i++;
    } else if (a === "--output-dir" || a === "-o") {
      args.outputDir = requireValue(a, i, argv);
      i++;
    } else if (a === "--max-chars") {
      const v = requireValue(a, i, argv);
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error("--max-chars requires a positive number");
      }
      args.maxChars = n;
      i++;
    } else {
      rest.push(a);
    }
  }
  
  if (rest[0] && !args.url) args.url = rest[0];
  return args;
}

function printHelp() {
  const msg = `
Summarizely CLI

Usage:
  summarizely <youtube-url> [options]

Options:
  -h, --help               Show help
  -v, --version            Show version
  -p, --provider <name>    Provider: claude-cli|codex-cli|ollama
  -m, --model <name>       Model preset (default: smallest model for Ollama)
  -o, --output-dir <dir>   Output directory (default: summaries)
      --no-save-transcript Do not write transcript .vtt/.txt files next to summary
      --max-chars <n>      Max transcript chars for CLI providers (default ~80k)
      --no-cap             Disable transcript cap for CLI providers
`;
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

async function main() {
  const argv = process.argv.slice(2);
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (e: any) {
    printHelp();
    process.stderr.write(`\nError: ${e?.message || 'invalid arguments'}\n`);
    process.exitCode = 2;
    return;
  }

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

  // Initialize caps
  let caps: any = null;

  // Check if transcript already exists for this video in directory structure
  if (!caps && vid && fs.existsSync(outputDir)) {
    const dirs = fs.readdirSync(outputDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name.includes('_'));
    
    // Look for existing transcript in any directory
    for (const dir of dirs) {
      const metaPath = path.join(outputDir, dir.name, 'metadata.json');
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          if (meta.videoId === vid) {
            // Found a directory with this video ID
            const transcriptPath = path.join(outputDir, dir.name, 'transcript.txt');
            const summaryPath = path.join(outputDir, dir.name, 'summary_full.md');
            
            // Check if we have a cached summary that matches our provider/model
            if (fs.existsSync(summaryPath) && fs.existsSync(transcriptPath)) {
              // Get the requested provider (either from args or auto-detected)
              const tempChoice = selectProvider(process.env);
              const requestedProvider = args.provider || tempChoice.provider;
              
              // Check if the cached summary matches our requirements
              if (meta.provider === requestedProvider && 
                  (!args.model || meta.model === args.model)) {
                process.stderr.write(`> Using cached summary for video ${vid} (${meta.provider}${meta.model ? '/' + meta.model : ''})\n`);
                const cachedSummary = fs.readFileSync(summaryPath, 'utf8');
                process.stdout.write(cachedSummary);
                return; // Exit early - no API calls needed!
              }
            }
            
            if (fs.existsSync(transcriptPath)) {
              process.stderr.write(`> Found existing transcript for video ${vid} in ${dir.name}\n`);
              
              // Load plain transcript
              const transcript = fs.readFileSync(transcriptPath, 'utf8');
              caps = {
                title: meta.title || 'YouTube Video',
                videoId: vid,
                url,
                transcript
              };
              process.stderr.write(`> Using existing transcript from: ${dir.name}/transcript.txt\n`);
              break;
            }
          }
        } catch (e) {
          // Continue checking other directories
        }
      }
    }
  }

  // Fetch captions if not found locally
  if (!caps) {
    process.stderr.write('> Fetching captions via yt-dlp...\n');
    caps = fetchCaptions(url);
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
    // Transcript fetched successfully
  }

  // Provider routing
  const choice = selectProvider(process.env);
  let markdown: string | null = null;
  if (args.provider) {
    const validProviders = ['claude-cli', 'codex-cli', 'ollama'];
    if (!validProviders.includes(args.provider)) {
      printHelp();
      process.stderr.write(`\nError: unknown provider: ${args.provider}. Valid options: ${validProviders.join(', ')}\n`);
      process.exitCode = 2;
      return;
    }
    choice.provider = args.provider as any;
  }
  
  // Exit if no provider is available
  if (!choice.provider) {
    process.stderr.write('No provider available. Install a CLI provider (claude, codex), Ollama, or set an API key.\n');
    process.stderr.write(`Reason: ${choice.reason}\n`);
    process.exitCode = 5;
    return;
  }
  
  if (choice.provider) {
    // Generate summary {
      const isCliProvider = choice.provider === 'claude-cli' || choice.provider === 'codex-cli';
      const maxChars = isCliProvider && !args.noCap ? (args.maxChars ?? 80000) : undefined;
      const prompt = buildPrompt(caps, vid || caps.videoId, maxChars ? { maxChars } : undefined);
      
      // Simple retry logic - 3 attempts
      let lastError: any;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          markdown = await summarizeWithProvider(choice.provider as any, caps, prompt, { model: args.model });
          break;
        } catch (e: any) {
          lastError = e;
          if (attempt < 3) {
            process.stderr.write(`> Retry attempt ${attempt} after error: ${e.message}\n`);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Simple backoff
          }
        }
      }
      if (!markdown && lastError) {
        // Print friendly provider error and exit
        if (lastError instanceof ProviderError) {
          process.stderr.write(formatProviderError(choice.provider as any, lastError) + '\n');
        } else {
          process.stderr.write(`Provider error: ${lastError?.message || lastError}\n`);
        }
        process.exitCode = 5;
        return;
      }
  }
  if (!markdown) {
    process.stderr.write(`Provider ${choice.provider} returned no output\n`);
    process.exitCode = 5;
    return;
  }

  // Output writing — summaries/<ISO>_<Title>/
  ensureDir(outputDir);
  const titleRaw = caps.title || vid || 'video';
  const titleUnderscore = titleRaw.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 120);
  const stamp = toIsoCompact(new Date()); // YYYY-MM-DDTHH-mm-ssZ
  const videoDir = path.join(outputDir, `${stamp}_${titleUnderscore}`);
  ensureDir(videoDir);
  const fpath = path.join(videoDir, 'summary_full.md');
  fs.writeFileSync(fpath, markdown, 'utf8');
  
  // Collect files to copy to _latest directory
  const filesToLatest: { source: string; name: string }[] = [
    { source: fpath, name: 'summary_full.md' }
  ];
  
  if (!args.noSaveTranscript) {
    const txtPath = path.join(videoDir, 'transcript.txt');
    try {
      const plain = String(caps.transcript || '').trim();
      fs.writeFileSync(txtPath, plain, 'utf8');
      filesToLatest.push({ source: txtPath, name: 'transcript.txt' });
    } catch {}
  }
  
  // Lightweight metadata for parity with yt-summary
  try {
    const meta = {
      url,
      videoId: caps.videoId,
      title: caps.title,
      createdAt: new Date().toISOString(),
      provider: choice.provider ?? 'none',
      model: args.model || undefined,
    };
    const metaPath = path.join(videoDir, 'metadata.json');
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
    filesToLatest.push({ source: metaPath, name: 'metadata.json' });
  } catch {}
  
  // Update the _latest directory with all files
  writeToLatestDir(outputDir, filesToLatest);

  // Always output the markdown summary
  process.stdout.write(markdown + '\n');
}

main().catch((err) => {
  process.stderr.write(`Unexpected error: ${err?.message || err}\n`);
  process.exitCode = 1;
});

// Friendly provider error messages are formatted in providers.formatProviderError

#!/usr/bin/env node
/*
  Summarizely CLI — scaffold
  Usage: summarizely <youtube-url> [--model <name>] [--captions-only] [--json]
*/

type Args = {
  url?: string;
  model?: string;
  captionsOnly?: boolean;
  json?: boolean;
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
    } else {
      rest.push(a);
    }
  }
  if (rest[0] && !args.url) args.url = rest[0];
  return args;
}

function printHelp() {
  const msg = `\nSummarizely CLI\n\nUsage:\n  summarizely <youtube-url> [options]\n\nOptions:\n  -h, --help            Show help\n  -v, --version         Show version\n      --model <name>    Model preset (noop now)\n      --captions-only   Force captions-only (placeholder)\n      --json            Output JSON (placeholder)\n`;
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
  const args = parseArgs(argv);

  if (args.help) return printHelp();
  if (args.version) return process.stdout.write(getVersion() + "\n");

  if (!isYouTubeUrl(args.url)) {
    printHelp();
    process.stderr.write("\nError: please provide a valid YouTube URL.\n");
    process.exitCode = 2;
    return;
  }

  // Placeholder execution path
  const banner = [
    `task: summarize`,
    `url: ${args.url}`,
    `model: ${args.model ?? "default"}`,
    `captions-only: ${args.captionsOnly ? "yes" : "no"}`,
    `format: ${args.json ? "json" : "markdown"}`,
  ].join(" | ");

  if (args.json) {
    const out = {
      status: "ok",
      message: "Summary generation coming soon",
      url: args.url,
      model: args.model ?? "default",
      captionsOnly: !!args.captionsOnly,
      items: [] as any[],
    };
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  } else {
    process.stdout.write(`# Summarizely\n\n_${banner}_\n\n> Summary generation coming soon.\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`Unexpected error: ${err?.message || err}\n`);
  process.exitCode = 1;
});


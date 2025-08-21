# Summarizely CLI

Quickly turn a YouTube link into a concise summary.

**Version 1.2.0** - Radically simplified with lean, focused testing.

## Philosophy

### Core Beliefs
- **No API Keys**: Use your existing Claude/Codex subscriptions or local models - no secrets to manage
- **Own Your Agent**: Complete control over your tools. No vendor lock-in, no forced cloud dependencies
- **Quality First**: No degraded fallbacks - we require an LLM for quality output
- **Speed Through Simplicity**: No API key management means simpler, more maintainable code
- **Zero Surprises**: No hidden costs, no unexpected bills, transparent operation

### Why No API Keys?
Instead of managing API keys that leak in logs and create billing anxiety, we use:
- Claude CLI - Uses your existing Claude Pro subscription
- Codex CLI - Uses your existing Codex access
- Ollama - Runs entirely locally, no auth needed

### What We're NOT Building
- Not a video enhancement tool - we replace watching videos entirely
- Not a universal summarizer - we do YouTube videos with captions, and do it well
- Not a freemium service - you bring your own LLM, you get full functionality

## Quickstart

- Requirements: Node.js 18+, `yt-dlp` (recommended), and a provider (Claude CLI, Codex CLI, or Ollama).
- Install deps and build:

```
npm install
npm run build
npm link   # optional, to use `summarizely` globally
```

## Usage

```bash
# Basic usage
summarizely https://www.youtube.com/watch?v=VIDEO_ID

# With specific provider
summarizely https://www.youtube.com/watch?v=VIDEO_ID --provider claude-cli
summarizely https://www.youtube.com/watch?v=VIDEO_ID --provider ollama --model llama3.2:1b
```

Flags:
- `-p, --provider <name>`: Provider selection (claude-cli|codex-cli|ollama). Auto-detects if not specified.
- `-m, --model <name>`: Model to use (for Ollama only)
- `-o, --output-dir <dir>`: Output directory (default: `summaries`)
- `--no-save-transcript`: Skip saving transcript files
- `--max-chars <n>`: Max transcript length for CLI providers (default: 80000)
- `--no-cap`: Disable transcript truncation for CLI providers
- `-h, --help`: Show help message
- `-v, --version`: Show version

## Dependencies

- Captions: `yt-dlp` recommended for reliability.
  - macOS: `brew install yt-dlp`
  - Linux: `pipx install yt-dlp` (or `pip install --user yt-dlp`)
  - Windows: `winget install yt-dlp` (or `choco install yt-dlp`)
- Local model (optional): Ollama with a small model like `llama3.2:1b`.
  - macOS/Linux: `curl -fsSL https://ollama.com/install.sh | sh`
  - Windows: download installer from https://ollama.com

Provider order: CLI → Ollama.

## External CLI Providers

You can optionally use installed CLIs that already manage authentication on your machine (no API keys in this tool):

- Codex CLI: `codex exec` (stdin)
- Claude CLI: `claude` (stdin)

Usage:

```
# Use Codex CLI as the LLM provider (stdin)
summarizely <url> --provider codex-cli

# Use Claude CLI as the LLM provider (stdin)
summarizely <url> --provider claude-cli
```

Notes:
- We generate a Markdown prompt + transcript and pipe to the chosen CLI (Claude uses `-p`).
- If the CLI returns a non‑zero exit or times out, we print an actionable error and exit with code 5. There is no fallback summarizer.
- CLI providers apply a default transcript cap of ~80k characters. Override with `--max-chars <n>` or disable with `--no-cap`.

## Development

- Build: `npm run build`
- Test: `npm test` (runs 8 essential tests)

## Output

Files are **always** written to disk under `summaries/<YYYY-MM-DDTHH-mm-ssZ>_<Title>/`:
- `summary_full.md` - The full Markdown summary
- `transcript.txt` - Plain text transcript (unless `--no-save-transcript`)
- `metadata.json` - Video metadata (URL, title, videoId, provider, model, createdAt)

A `summaries/_latest/` folder always contains a copy of the most recent run.

**Transcript Reuse**: If a transcript already exists in the summaries directory for a video, it will be reused to save time.

### Terminal Output (stdout)

The full Markdown summary is printed to your terminal.

For scripting, all metadata is available in the output directory:
- `metadata.json` contains URL, video ID, title, provider, and timestamp
- Exit codes indicate success (0) or specific failure types (2-5)

## Behavior & Fallbacks

- Captions: prefers `yt-dlp` (JSON + VTT). If missing, prints install guidance. There is no JS transcript fallback in v1.
- Providers: auto-detects available provider unless `--provider` is set.
  - If no provider is available or selected, the CLI exits with code 5 and prints guidance on configuring a provider.
  - Ollama: uses `OLLAMA_HOST` (default `http://127.0.0.1:11434`). If `--model` not set, picks the smallest installed `*instruct` model. If no models are installed, we suggest: `ollama pull llama3.2:1b`.
- Language: English-only in v1; Mandarin and others coming later.

## Prompt (LLM mode)

Narrative‑first, free‑flowing Markdown summary driven by the transcript. The model follows the speaker’s natural arc, keeps wording succinct, and uses interesting formatting without rigid sections.

The summary begins with a lightweight metadata header:

```
# <Title>

**URL:** <video-url>  
**Channel:** <channel-name>  
**Published:** <YYYY-MM-DD>  
**Duration:** <H:MM:SS>  
**Views:** <compact-count>  
**Likes:** <compact-count>  
**Summary Type:** Full  
**Generated:** <ISO timestamp>

---
```

Then write a vivid, chronological summary with:
- Strong rhythm and zero filler.
- Flexible formatting: micro‑headings, short bullets, callouts/side‑notes, pull quotes; tasteful emojis if they fit.
- Concrete specifics (names, numbers, terms, examples) woven in naturally.
- Optional brief “Highlights” ribbon and tiny “Takeaways” list at the end.

Notes:
 - Optional timestamps like `[mm:ss]` may be used sparingly for orientation.
 - Channel/Published/Duration lines appear when available from yt-dlp metadata.
 - Views/Likes appear when available and are compact-formatted (e.g., 1.2M).

## Exit Codes

- 2: invalid URL/args
- 4: captions unavailable
- 5: provider error (e.g., no provider configured, auth/timeout issues)
- 1: unknown error

## Troubleshooting

- `yt-dlp not found`: install using one of the commands above, then rerun.
- No CLI tools and no Ollama: the CLI will exit with code 5. Configure a provider (install Claude CLI, Codex CLI, or run Ollama).
- Output not appearing: ensure you have write permissions to the current directory; use `--output-dir` to change.
- Ollama unreachable: ensure the daemon is running (`ollama serve`) and `OLLAMA_HOST` is correct.
- No Ollama models: run `ollama pull llama3.2:1b` (or any small model like `gemma2:2b`).

## Future Roadmap

- ASR support for videos without captions (using Whisper API)
- Additional language support beyond English

License: Apache-2.0 — see [LICENSE](./LICENSE).

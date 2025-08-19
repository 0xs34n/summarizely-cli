# Summarizely CLI

Quickly turn a YouTube link into a concise, timestamped summary.

Status: v1 with captions-only flow, extractive summarizer fallback, and provider routing stubs (LLM providers optional).

## Quickstart

- Requirements: Node.js 18+, `yt-dlp` (recommended), optional Ollama or API keys.
- Install deps and build:

```
npm install
npm run build
npm link   # optional, to use `summarizely` globally
```

## Usage

```
summarizely --help
summarizely https://www.youtube.com/watch?v=VIDEO_ID [--provider claude-cli|codex-cli|ollama|openai|anthropic|google] [--model qwen2.5:0.5b-instruct] [--output-dir summaries] [--stream|--json]
```

Flags:
- `--provider <name>`: provider selection; defaults to auto-detect (CLI→Ollama→OpenAI→Anthropic→Google→extractive)
- `--model <name>`: model preset (default for Ollama: `qwen2.5:0.5b-instruct`)
- `--output-dir <dir>`: output directory (default `summaries/`)
- `--captions-only`: force captions path, no ASR (v1 has no ASR anyway)
- `--stream`: stream provider output live to stdout (mutually exclusive with `--json`)
- `--json`: output JSON metadata instead of Markdown to stdout (file still written)

## Dependencies

- Captions: `yt-dlp` recommended for reliability.
  - macOS: `brew install yt-dlp`
  - Linux: `pipx install yt-dlp` (or `pip install --user yt-dlp`)
  - Windows: `winget install yt-dlp` (or `choco install yt-dlp`)
- Local model (optional): Ollama with `qwen2.5:0.5b-instruct`.
  - macOS/Linux: `curl -fsSL https://ollama.com/install.sh | sh`
  - Windows: download installer from https://ollama.com

Cloud providers (optional): set `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GOOGLE_API_KEY`.
  - OpenAI (non-stream in v1): defaults to `gpt-4o-mini` unless `--model` is provided.

Provider order: Ollama → OpenAI → Anthropic → Google → extractive (no LLM).

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
- We generate a Markdown prompt + transcript and pipe to the chosen CLI via stdin.
- If the CLI returns a non‑zero exit or times out, we fall back to the extractive summary and show an actionable error.
- Very long transcripts may exceed CLI limits; we apply an adaptive cap for CLI providers (default ~80k chars, configurable via `--max-chars` or disable with `--no-cap`). Chunking is on the roadmap.

## Development

- Build: `npm run build`
- Test: `npm test` (placeholders and unit tests only)

## Output

- Files written to `summaries/` (created if missing) with lexicographically sortable names:
  - `YYYY-MM-DDTHH-mm-ssZ-<videoId>-<slug>.md`
  - `...-transcript.vtt` (original captions), saved by default
  - `...-transcript.txt` (plain text with timestamps), saved by default
- Opt out of transcript files with `--no-save-transcript`.
- Convenience copy at `summaries/latest.md` updated on each run.
- Unless `--json` is used, the Markdown is also printed to stdout.

## Behavior & Fallbacks

- Captions: prefers `yt-dlp` (JSON + VTT). If missing, attempts a JS transcript fallback (limited); otherwise prints install guidance.
- Providers: auto-detects available provider unless `--provider` is set.
  - If no provider available or selected, uses a deterministic extractive summarizer (no LLM) to ensure useful output.
  - Ollama: uses `OLLAMA_HOST` (default `http://127.0.0.1:11434`). If `--model` not set, picks the smallest installed `*instruct` model (prefers `qwen2.5:0.5b-instruct` when available). If no models are installed, we suggest: `ollama pull qwen2.5:0.5b-instruct`.
  - OpenAI: uses `OPENAI_API_KEY`; defaults to `gpt-4o-mini` (non-stream) unless `--model` is provided.
  - Claude (planned): uses `ANTHROPIC_API_KEY`; defaults to `claude-3-5-sonnet-latest` (non-stream) unless `--model` is provided.
- Language: English-only in v1; Mandarin and others coming later.

## Prompt (LLM mode)

Markdown only. Use only the transcript; no fabrication. Structure with: 1) TL;DR (3–5 bullets), 2) Key Ideas (short paragraphs), 3) Steps/How‑to, 4) Data/Stats (numbers, names), 5) Quotes (with [hh:mm:ss] links), 6) Open Questions. Bold important concepts. Use YouTube links: `https://youtu.be/VIDEO_ID?t=SECONDS`. Keep it clear and readable; adapt length to content.

## Exit Codes

- 2: invalid URL/args
- 3: missing dependency (e.g., `yt-dlp`) with guidance shown
- 4: captions unavailable
- 5: provider error
- 1: unknown error

## Troubleshooting

- `yt-dlp not found`: install using one of the commands above, then rerun.
- No provider keys and no Ollama: the CLI will still produce an extractive summary from captions.
- Output not appearing: ensure you have write permissions to the current directory; use `--output-dir` to change.
- Ollama unreachable: ensure the daemon is running (`ollama serve`) and `OLLAMA_HOST` is correct.
- No Ollama models: run `ollama pull qwen2.5:0.5b-instruct`.
- OpenAI auth errors: set `OPENAI_API_KEY`; rate limit errors may require retrying later or a shorter transcript.

## Roadmap Fit

- Week 1: captions-first, Markdown output, snapshot tests
- Week 3: ASR fallback (Whisper), billing gates

## Roadmap Fit

- Week 1: captions-first, Markdown output, snapshot tests
- Week 3: ASR fallback (Whisper), billing gates

License: Apache-2.0 — see [LICENSE](./LICENSE).

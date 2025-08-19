# Summarizely CLI

Quickly turn a YouTube link into a concise, timestamped summary. This is the CLI slice for Week 1 of the roadmap.

Status: v1 scaffold with captions-only flow, extractive summarizer fallback, and provider routing stubs.

## Install

- Node.js 18+ recommended.
- Clone this repo, then:

```
npm install
npm run build
npm link   # optional, to use `summarizely` globally
```

## Usage

```
summarizely --help
summarizely https://www.youtube.com/watch?v=VIDEO_ID [--provider ollama|openai|anthropic|google] [--model qwen2.5:0.5b-instruct] [--output-dir summaries] [--json]
```

Flags:
- `--provider <name>`: provider selection; defaults to auto-detect (ollama→openai→anthropic→google→extractive)
- `--model <name>`: model preset (default for Ollama: `qwen2.5:0.5b-instruct`)
- `--output-dir <dir>`: output directory (default `summaries/`)
- `--captions-only`: force captions path, no ASR (v1 has no ASR anyway)
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

## Development

- Build: `npm run build`
- Test: `npm test` (placeholders and unit tests only)

## Roadmap Fit

- Week 1: captions-first, Markdown output, snapshot tests
- Week 3: ASR fallback (Whisper), billing gates

> License: pending org choice (MIT or Apache-2.0 recommended for CLI). See top-level guidance.

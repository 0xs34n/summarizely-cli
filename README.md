# Summarizely CLI

Quickly turn a YouTube link into a concise summary.

Status: v1 with captions-only flow and provider routing stubs (LLM providers optional). No extractive fallback.

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
- `--provider <name>`: provider selection; defaults to auto-detect (CLI→Ollama→OpenAI→Anthropic→Google)
- `--model <name>`: model preset (default for Ollama: `qwen2.5:0.5b-instruct`)
- `--output-dir <dir>`: output root (default `summaries`)
- `--captions-only`: force captions path, no ASR (v1 has no ASR anyway)
- `--stream`: stream output for supported providers (currently Ollama only). Not available for CLI providers. Mutually exclusive with `--json`.
- `--json`: output JSON metadata to stdout instead of the full Markdown summary (all files are still saved to disk regardless)

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

Provider order: CLI → Ollama → OpenAI → Anthropic → Google.

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
- Test: `npm test` (placeholders and unit tests only)

## Output

Files are **always** written to disk under `summaries/<YYYY-MM-DDTHH-mm-ssZ>_<Title>/`:
- `summary_full.md` - The full Markdown summary
- `transcript.txt` - Plain text transcript (unless `--no-save-transcript`)
- `metadata.json` - Video metadata (URL, title, videoId, provider, createdAt)

A `summaries/_latest/` folder always contains a copy of the most recent run.

### Terminal Output (stdout)

By default, the full Markdown summary is printed to your terminal.

With `--json` flag, only metadata is printed (useful for scripting):
```json
{
  "status": "ok",
  "path": "summaries/2024-01-20T10-30-45Z_video_title/summary_full.md",
  "provider": "claude-cli",
  "url": "https://youtube.com/watch?v=VIDEO_ID",
  "videoId": "VIDEO_ID",
  "title": "Video Title"
}
```

Example usage in scripts:
```bash
# Get just the file path
path=$(summarizely $URL --json | jq -r '.path')

# Process multiple videos and collect metadata
for url in "${urls[@]}"; do
  summarizely "$url" --json >> results.jsonl
done
```

## Behavior & Fallbacks

- Captions: prefers `yt-dlp` (JSON + VTT). If missing, prints install guidance. There is no JS transcript fallback in v1.
- Providers: auto-detects available provider unless `--provider` is set.
  - If no provider is available or selected, the CLI exits with code 5 and prints guidance on configuring a provider.
  - Ollama: uses `OLLAMA_HOST` (default `http://127.0.0.1:11434`). If `--model` not set, picks the smallest installed `*instruct` model (prefers `qwen2.5:0.5b-instruct` when available). If no models are installed, we suggest: `ollama pull qwen2.5:0.5b-instruct`.
  - OpenAI: uses `OPENAI_API_KEY`; defaults to `gpt-4o-mini` (non-stream) unless `--model` is provided.
  - Claude (planned): uses `ANTHROPIC_API_KEY`; defaults to `claude-3-5-sonnet-latest` (non-stream) unless `--model` is provided.
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
- No provider keys and no Ollama: the CLI will exit with code 5. Configure a provider (install a CLI, run Ollama, or set an API key).
- Output not appearing: ensure you have write permissions to the current directory; use `--output-dir` to change.
- Ollama unreachable: ensure the daemon is running (`ollama serve`) and `OLLAMA_HOST` is correct.
- No Ollama models: run `ollama pull qwen2.5:0.5b-instruct`.
- OpenAI auth errors: set `OPENAI_API_KEY`; rate limit errors may require retrying later or a shorter transcript.

## Roadmap Fit

- Week 1: captions-first, Markdown output, snapshot tests
- Week 3: ASR fallback (Whisper), billing gates

License: Apache-2.0 — see [LICENSE](./LICENSE).

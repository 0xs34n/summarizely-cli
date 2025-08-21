# Summarizely CLI

[![npm version](https://img.shields.io/npm/v/summarizely-cli.svg)](https://www.npmjs.com/package/summarizely-cli)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![CI](https://github.com/0xs34n/summarizely-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/0xs34n/summarizely-cli/actions)

**Watch less. Learn more. Turn hours of YouTube into minutes of insights.**

YouTube video summarizer. No API keys required - uses your existing Claude Pro or ChatGPT subscription.

## Why?

- **10x faster** - 2-hour video → 2-minute read
- **Save hours** - Get the key insights without watching  
- **Zero friction** - Uses your existing AI subscriptions

## Installation

```bash
npm install -g summarizely-cli
```

Or from source:
```bash
git clone https://github.com/0xs34n/summarizely-cli.git
cd summarizely-cli
npm install && npm run build && npm link
```

## Requirements

- **Node.js 18+**
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)**: `brew install yt-dlp` (macOS) or `pip install yt-dlp` (Linux/Windows)
- **LLM Provider** (one of):
  - Claude CLI - uses your existing Claude Pro subscription
  - Codex CLI - uses your existing ChatGPT subscription  
  - Ollama - runs locally with models like `llama3.2:1b`

## Usage

```bash
# Auto-detect provider
summarizely https://www.youtube.com/watch?v=VIDEO_ID

# Specify provider
summarizely https://www.youtube.com/watch?v=VIDEO_ID --provider claude-cli
summarizely https://www.youtube.com/watch?v=VIDEO_ID --provider codex-cli
summarizely https://www.youtube.com/watch?v=VIDEO_ID --provider ollama --model llama3.2:1b
```

### Options

- `-p, --provider <name>` - Provider: claude-cli, codex-cli, or ollama
- `-m, --model <name>` - Model name (Ollama only)
- `-o, --output-dir <dir>` - Output directory (default: `summaries`)
- `--no-save-transcript` - Skip saving transcript
- `--max-chars <n>` - Max transcript length for CLI providers
- `-h, --help` - Show help
- `-v, --version` - Show version

## Output

Summaries are saved to `summaries/<timestamp>_<title>/` with:
- `summary_full.md` - The markdown summary
- `transcript.txt` - Plain text transcript
- `metadata.json` - Video metadata

The latest summary is also copied to `summaries/_latest/`.

## License

Apache-2.0 - see [LICENSE](./LICENSE)
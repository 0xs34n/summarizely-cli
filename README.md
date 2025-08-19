# Summarizely CLI

Quickly turn a YouTube link into a concise, timestamped summary. This is the CLI slice for Week 1 of the roadmap.

Status: scaffolded. The command parses args and prints placeholders until the core is implemented.

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
summarizely https://www.youtube.com/watch?v=VIDEO_ID
```

Flags:
- `--model <name>`: model preset to use later (noop for now)
- `--captions-only`: force captions path, no ASR (placeholder)
- `--json`: output JSON instead of Markdown (placeholder)

## Development

- Build: `npm run build`
- Test: `npm test` (placeholder)

## Roadmap Fit

- Week 1: captions-first, Markdown output, snapshot tests
- Week 3: ASR fallback (Whisper), billing gates

> License: pending org choice (MIT or Apache-2.0 recommended for CLI). See top-level guidance.


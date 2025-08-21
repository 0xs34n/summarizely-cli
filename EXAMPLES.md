# Summarizely CLI Examples

## Basic Usage

Summarize any YouTube video with captions:
```bash
summarizely https://youtube.com/watch?v=dQw4w9WgXcQ
```

## Provider Selection

### Use Ollama (local model)
```bash
summarizely https://youtube.com/watch?v=xyz --provider ollama
```

### Use Claude CLI
```bash
summarizely https://youtube.com/watch?v=xyz --provider claude-cli
```

### Use Codex CLI
```bash
summarizely https://youtube.com/watch?v=xyz --provider codex-cli
```

## Model Selection

Specify a model for Ollama:
```bash
summarizely https://youtube.com/watch?v=xyz --provider ollama --model llama3.2:1b
```

## Output Options

### Custom output directory
```bash
summarizely https://youtube.com/watch?v=xyz --output-dir ~/my-summaries
```

### Skip saving transcript
```bash
summarizely https://youtube.com/watch?v=xyz --no-save-transcript
```

## Transcript Size Management

### Limit transcript size (for long videos)
```bash
summarizely https://youtube.com/watch?v=LONG_VIDEO --max-chars 50000
```

### Remove transcript cap entirely
```bash
summarizely https://youtube.com/watch?v=LONG_VIDEO --no-cap
```

## Caching

When you run the same video again with the same provider/model, it uses the cached summary instantly:
```bash
# First run: makes API call
summarizely https://youtube.com/watch?v=xyz --provider ollama

# Second run: instant cached result
summarizely https://youtube.com/watch?v=xyz --provider ollama

# Different provider: makes new API call
summarizely https://youtube.com/watch?v=xyz --provider claude-cli
```

## Common Workflows

### Research workflow
```bash
# Summarize a conference talk
summarizely https://youtube.com/watch?v=CONFERENCE_TALK

# Review the summary
cat summaries/_latest/summary_full.md

# Search the transcript for specific terms
grep -i "machine learning" summaries/_latest/transcript.txt
```

### Daily news summary
```bash
# Morning news summary
summarizely https://youtube.com/watch?v=MORNING_NEWS --provider ollama --model llama3.2:1b
```

### Educational content
```bash
# Lecture with full transcript preservation
summarizely https://youtube.com/watch?v=LECTURE_ID --no-cap
```

## Tips

1. **Speed**: Ollama with small models (1-2B params) is fastest
2. **Quality**: Claude CLI generally produces best summaries
3. **Caching**: Summaries are cached by video + provider + model
4. **Transcripts**: Saved by default for searching and reference
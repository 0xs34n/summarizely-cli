# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2025-01-21

### 🎯 Radical Test Simplification

This release dramatically simplifies the test suite:

### Changed

- **Test reduction** - From 1,436 lines to 122 lines (92% reduction!)
- **File consolidation** - From 6 test files to 1 simple test.js
- **Focus on essentials** - Only 8 critical tests that matter
- **No complex mocking** - Direct, simple testing
- **Test-to-code ratio** - From 1.42:1 to 0.12:1 (appropriate for a CLI tool)

### Removed

- Integration tests (unnecessary complexity)
- Test helpers and mocking infrastructure
- Tests for non-existent features
- Multiple test runners

## [1.1.0] - 2025-01-21

### 🎯 Maximum Simplicity

This release optimizes for simplicity and effectiveness:

### Removed

- **JSON output feature** - Simplified to always output markdown
- **Caching system** - Removed complexity, just re-run when needed
- **Retry module** - Inlined simple 3-attempt logic
- **API provider references** - Only CLI tools and Ollama now
- **Batch processing** - Removed for single-purpose clarity
- **Multiple test runners** - Consolidated to single runner

### Changed

- **Code reduction** - From 1337 to ~1150 lines (14% reduction)
- **Simpler interface** - Fewer flags and options
- **Philosophy integrated** - Merged into README
- **Test consolidation** - Single unified test runner

### Result

- Faster execution (no cache checks)
- Easier to understand (fewer concepts)
- More maintainable (less code = fewer bugs)
- All tests passing

## [1.0.0] - 2025-01-20

### 🎯 Philosophy

This release establishes Summarizely CLI's core philosophy:

- **No API Keys**: Use existing Claude/Codex subscriptions or local models
- **Own Your Summaries**: All processing local, all data yours
- **Quality First**: No degraded fallbacks - requires LLM for quality output

### Added

- **Test Suite** - 35 tests across unit test files
  - Unit tests for core modules
  - Shared test helpers and mocking utilities

### Changed

- **Version 1.0.0** - Production-ready release
- **Documentation** - Clear philosophy and usage

### Fixed

- CLI test error message validation
- Provider test fallback expectations
- Core tests for new prompt format
- YouTube embed URL parsing support

## [0.2.0] - 2025-08-20

### Added

- **Provider selection** - Auto-detect between CLI tools and Ollama
- **Transcript reuse** - Check existing summaries directory for transcripts
- **Exit codes** - Specific codes for different failure types

### Changed

- Improved error handling and messages
- Enhanced provider selection logic

### Fixed

- Provider error messages now display user-friendly text

## [0.1.0] - 2025-08-19

### Added

- Initial release of Summarizely CLI
- YouTube video summarization via captions
- Three provider support:
  - Claude CLI (`claude -p`)
  - Codex CLI (`codex exec`)
  - Ollama (local models)
- Automatic provider detection (CLI → Ollama)
- Markdown output with metadata header
- VTT caption parsing
- Streaming support for Ollama (removed in v1.1.0)
- Transcript saving alongside summaries
- `_latest` directory with most recent summary

### Security

- No API keys stored or required
- Uses existing authenticated CLI tools
- All processing done locally

## [0.0.1] - 2025-08-18

### Added

- Initial project setup
- Basic TypeScript configuration
- Core module structure

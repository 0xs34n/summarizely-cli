# Contributing to Summarizely CLI

Thank you for your interest in contributing to Summarizely CLI!

## Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/summarizely-cli.git`
3. Install dependencies: `npm install`
4. Install yt-dlp: `brew install yt-dlp` (macOS) or `pip install yt-dlp` (Linux/Windows)
5. Build the project: `npm run build`
6. Run tests: `npm test`

## Guidelines

### Code Style
- TypeScript with strict mode enabled
- 2 spaces for indentation
- Use meaningful variable names
- Add types for all function parameters and returns

### Commits
- Use clear, descriptive commit messages
- Keep commits focused on a single change
- Reference issues when applicable

### Pull Requests
- Create a branch for your feature: `git checkout -b feature/your-feature`
- Ensure all tests pass before submitting
- Update documentation if needed
- Add tests for new functionality
- Keep PRs focused and small when possible

### Testing
- Run tests: `npm test`
- Tests are in `tests/test.js` (8 essential tests)
- Test coverage includes:
  - YouTube URL parsing
  - Date formatting utilities
  - VTT transcript parsing
  - Provider selection logic
  - CLI argument handling
  - Prompt building
- Test with different YouTube video types
- Verify error handling works correctly
- CI/CD runs tests automatically on push/PR

## Reporting Issues

- Check existing issues first
- Include steps to reproduce
- Provide error messages and logs
- Mention your OS and Node version

## Feature Requests

- Explain the use case
- Provide examples if possible
- Consider implementation complexity

## Questions?

Feel free to open an issue for discussion or clarification.

## License

By contributing, you agree that your contributions will be licensed under the Apache-2.0 License.
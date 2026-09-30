# CLAUDE.md - AI Assistant Guide for Mindvalley Repository

> This file provides context and guidelines for AI assistants working with this codebase.

## Repository Status

**Current State:** Pre-Watch MVP (pre-release audience attention testing for long-form video). See `README.md`.

## Project Overview

- **Stack:** Node.js 22.18+ running TypeScript directly (type stripping), built-in `node:sqlite`, no runtime
  dependencies. Front ends are plain ES modules in `public/` with hls.js and MediaPipe loaded from jsDelivr.
- **Layout:**
  - `src/` server: `app.ts` (routes), `db.ts` (SQLite), `scoring.ts`, `quality.ts`, `exports.ts`, `hlsProxy.ts`,
    `sources/` (Dropbox Replay resolver), `simulate.ts` (synthetic panel)
  - `public/studio/` internal studio app; `public/watch/` panelist app (`tracker.js` = on-device gaze tracking)
  - `tests/` node:test suites; `scripts/simulate.ts` CLI
- **Commands:** `npm start`, `npm run dev`, `npm test`, `npm run typecheck`, `npm run simulate -- <testId> [n]`
- **Rules:** TypeScript must stay erasable (no enums, namespaces or parameter properties) and imports use `.ts`
  extensions. Webcam frames must never leave the browser; only derived yes/no signals are uploaded.

## Development Conventions

### Git Workflow

1. **Branch Naming**
   - Feature branches: `feature/<description>`
   - Bug fixes: `fix/<description>`
   - Claude/AI work: `claude/<task-id>`

2. **Commit Messages**
   - Use conventional commits format: `type(scope): description`
   - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
   - Keep messages concise but descriptive

3. **Before Committing**
   - Run linting and formatting
   - Run tests if available
   - Review changes with `git diff`

### Code Quality Standards

1. **Always prefer**:
   - Type safety (TypeScript, Python type hints, etc.)
   - Descriptive variable and function names
   - Small, focused functions
   - Comprehensive error handling

2. **Avoid**:
   - Hardcoded secrets or credentials
   - Large, monolithic files
   - Unnecessary dependencies
   - Code duplication

### Security Guidelines

- Never commit secrets, API keys, or credentials
- Use environment variables for sensitive configuration
- Add sensitive file patterns to `.gitignore`
- Review dependencies for known vulnerabilities

## Common Tasks

### Creating a New Feature

1. Understand the requirements
2. Plan the implementation (use TodoWrite tool)
3. Write the code with tests
4. Update documentation if needed
5. Commit with descriptive message
6. Push to the appropriate branch

### Debugging Issues

1. Read error messages carefully
2. Check logs and stack traces
3. Reproduce the issue
4. Isolate the problem
5. Fix and verify the solution

## Updating This File

When the project is initialized and has actual content, update this CLAUDE.md to include:

- [ ] Actual project description and purpose
- [ ] Real directory structure
- [ ] Build commands and scripts
- [ ] Testing instructions
- [ ] Deployment information
- [ ] API documentation links
- [ ] Team conventions and standards
- [ ] Environment setup instructions

---

*Last updated: 2026-09-30*

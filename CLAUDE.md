# CLAUDE.md - AI Assistant Guide for Mindvalley Repository

> This file provides context and guidelines for AI assistants working with this codebase.

## Repository Status

**Current State:** Empty/Uninitialized Repository

This is a freshly initialized Git repository under the `mindvalley` namespace. No project files, source code, or configuration have been added yet.

## Repository Information

- **Repository Name:** mindvalley
- **Remote URL:** Configured via local proxy
- **Primary Development Branch:** `claude/claude-md-mktiw4wik5zldpeg-BXXz3`

## For AI Assistants: Getting Started

### When Initializing This Repository

If tasked with setting up this project, follow these conventions:

1. **Determine Project Type First**
   - Ask the user what type of project this should be (web app, API, library, etc.)
   - Identify the technology stack requirements

2. **Recommended Project Structure Patterns**

   For a **Node.js/TypeScript project**:
   ```
   mindvalley/
   ├── src/                  # Source code
   │   ├── index.ts          # Main entry point
   │   ├── types/            # TypeScript type definitions
   │   ├── utils/            # Utility functions
   │   └── lib/              # Core library code
   ├── tests/                # Test files
   ├── docs/                 # Documentation
   ├── package.json          # Dependencies and scripts
   ├── tsconfig.json         # TypeScript configuration
   ├── .gitignore            # Git ignore rules
   ├── .eslintrc.js          # ESLint configuration
   ├── .prettierrc           # Prettier configuration
   ├── README.md             # Project documentation
   └── CLAUDE.md             # This file (AI assistant guide)
   ```

   For a **Python project**:
   ```
   mindvalley/
   ├── src/
   │   └── mindvalley/       # Main package
   │       ├── __init__.py
   │       └── main.py
   ├── tests/
   ├── requirements.txt      # Dependencies
   ├── setup.py              # Package setup
   ├── pyproject.toml        # Modern Python config
   ├── .gitignore
   ├── README.md
   └── CLAUDE.md
   ```

### Essential Files to Create

When initializing, always create these files:

1. **`.gitignore`** - Prevent committing sensitive/generated files
2. **`README.md`** - Project documentation
3. **Package manifest** - `package.json`, `requirements.txt`, `Cargo.toml`, etc.
4. **Configuration files** - Linting, formatting, build tools

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

*Last updated: 2026-01-25*
*Status: Awaiting project initialization*

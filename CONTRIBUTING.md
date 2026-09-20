# Contributing to Krypton

Thank you for your interest in contributing to **Krypton**! 

Krypton is a local-first, cross-platform autonomous desktop AI agent runtime built with Tauri v2, Rust, Next.js 16, and Node.js. Our mission is to deliver an uncompromised, zero server lock-in agent operating system that runs entirely on your local machine.

Whether you are fixing a bug, adding an omni-channel adapter, improving browser automation, or refining documentation, we welcome your contributions.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Prerequisites & Environment Setup](#prerequisites--environment-setup)
3. [Monorepo Structure](#monorepo-structure)
4. [Development Workflow](#development-workflow)
5. [Git Conventions & Krypton-VCS](#git-conventions--krypton-vcs)
6. [Testing & Quality Verification](#testing--quality-verification)
7. [Documentation Policy (Zero-Drift)](#documentation-policy-zero-drift)
8. [Submitting a Pull Request](#submitting-a-pull-request)
9. [Community & Support](#community--support)

---

## Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free environment for all contributors. Please treat all members of the community with respect, empathy, and professional courtesy regardless of background, experience level, or identity.

---

## Prerequisites & Environment Setup

Before building Krypton, ensure your development system satisfies the following prerequisites:

| Tool | Minimum Version | Notes |
| :--- | :--- | :--- |
| **Node.js** | `>= 20.x` | LTS recommended |
| **pnpm** | `>= 10.x` (`10.32.1`) | Monorepo package manager (do not use `npm` or `yarn`) |
| **Rust & Cargo** | `>= 1.98` | Required for Tauri v2 native core |
| **Bun** | Latest | Used in build scripts and high-speed execution |
| **C++ Build Tools** | Visual Studio Build Tools (Windows) / Xcode CLI Tools (macOS) / `build-essential` (Linux) | Native compilation |

### 1. Validate Host Environment

Run our environment validation script to automatically check your installed toolchains:

```bash
node scripts/setup-env.mjs
```

### 2. Install Dependencies

Install all dependencies across the monorepo workspaces:

```bash
pnpm install
```

---

## Monorepo Structure

Krypton is organized as a pnpm workspace with strict dependency boundaries:

```
krypton/
├── apps/
│   └── desktop/                 # Tauri v2 native shell + Next.js 16 React UI
│       ├── src/                 # Desktop frontend (Chatbar, Krypton Synapse, DiffViewer)
│       └── src-tauri/           # Rust native core (IPC commands, window management)
│
├── packages/
│   ├── shared-types/            # Canonical source of truth: TypeScript interfaces, Zod schemas, IPC contracts
│   ├── agent-runtime/           # Autonomous daemon engine (Actor engine, Task DAG planner, sandboxing, PTY)
│   └── cli/                     # Standalone terminal companion built with React + Ink
│
├── scripts/                     # Toolchain validation, sidecar compilation, and installer harvesting
├── docs/                        # Modular technical documentation suite (indexed by docs/INDEX.md)
└── .github/                     # GitHub Actions CI/CD workflows and issue/PR templates
```

> [!IMPORTANT]
> **Type Source of Truth**: All shared interfaces, Zod schemas, and IPC message contracts live in `packages/shared-types`. Any contract modification must happen in `packages/shared-types` first before updating consumer packages.

---

## Development Workflow

### Building Monorepo Packages

```bash
# Build all packages in topological order
pnpm run build

# Compile internal standalone sidecar binaries (krypton-daemon & krypton-cli)
pnpm run build:binaries
```

### Running in Development Mode

Depending on which subsystem you are actively working on:

```bash
# Launch the desktop UI in development
pnpm run dev

# Launch desktop app with Tauri v2 native host
pnpm run dev:tauri

# Run the background agent daemon in standalone development mode
pnpm run dev:daemon

# Run the CLI companion terminal UI
pnpm run dev:cli
```

---

## Git Conventions & Krypton-VCS

### Branch Naming

Use descriptive branch names with conventional prefixes:
- `feat/synapse-waveform` (new features)
- `fix/browser-context-leak` (bug fixes)
- `docs/storage-schema-update` (documentation updates)
- `refactor/task-dag-planner` (refactoring code)
- `chore/upgrade-tauri` (maintenance tasks)

### Conventional Commits

All commits must adhere to the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.

Examples:
- `feat(desktop): add audio reactive waveform to synapse`
- `fix(runtime): prevent browser context leak on task abort`
- `docs(index): register storage schema reference`

### Krypton-VCS Worktree Isolation

Automated agent coding tasks run inside isolated Git worktrees (`~/.krypton/worktrees/<task-id>`) to prevent active branch pollution. Manual human contributions should also keep branches atomic and cleanly separated.

---

## Testing & Quality Verification

Before committing or opening a Pull Request, run the full verification suite to guarantee zero regression:

```bash
# 1. Typecheck all TypeScript packages
pnpm run typecheck

# 2. Run full monorepo test suite and cargo check
pnpm run test:all

# 3. Native Rust validation
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

All CI checks in `.github/workflows/ci.yml` must pass across Windows, macOS, and Linux runners.

---

## Documentation Policy (Zero-Drift)

Krypton enforces a strict **Zero-Drift Documentation Policy**:

1. **Keep Docs in Sync**: Whenever you add a feature, refactor code, modify an IPC schema, or change a CLI command, you **must** update the corresponding modular document in `docs/`.
2. **Register New Domains**: If introducing a new technical domain or subsystem, create a modular document (~100–250 lines) in `docs/<category>/` and register it with a relative link in [`docs/INDEX.md`](docs/INDEX.md).
3. **No Stale Context**: Documentation must accurately reflect the codebase so developers and AI agents never operate on obsolete assumptions.

---

## Submitting a Pull Request

1. **Check Existing Issues**: Check the [Issues](https://github.com/Istiyaq-Khan/krypton/issues) tab to ensure your work does not duplicate existing efforts or RFCs.
2. **Link Issues**: Every pull request must reference an associated GitHub issue using standard GitHub keywords (`Fixes #123` or `Closes #123`) in the description.
3. **Fill the PR Template**: Use the provided template in `.github/pull_request_template.md` to document your summary, change type, key modifications, and verification checklist.
4. **Single-Artifact Adherence**: Ensure your changes adhere to the 1 OS = 1 Package rule. Never decouple sidecar binaries into separate distribution packages.

---

## Community & Support

- **Bug Reports**: Open an issue using the [Bug Report template](https://github.com/Istiyaq-Khan/krypton/issues/new?template=bug_report.md).
- **Feature Proposals**: Open an issue using the [Feature Request template](https://github.com/Istiyaq-Khan/krypton/issues/new?template=feature_request.md).
- **Security Vulnerabilities**: Please review our [Security Policy](SECURITY.md) and report security findings privately.

Thank you for helping build Krypton! 🚀

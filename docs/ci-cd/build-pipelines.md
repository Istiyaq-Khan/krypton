# Build Pipelines & Monorepo Compilation

This document describes the monorepo build commands, standalone binary compilation scripts, environment validation, and prerequisites in **Krypton**.

---

## 1. Prerequisites Validation (`scripts/setup-env.mjs`)

Before building, validate the host development environment:
```bash
node scripts/setup-env.mjs
```

### Required Toolchains:
- **Node.js**: Version `>= 20.0.0`
- **pnpm**: Version `10.32.1`
- **Rust & Cargo**: Stable toolchain
- **Bun**: Latest (used as standalone single-binary compiler engine)
- **Git**: System git installation

---

## 2. Standard Build Workflow

### Step 1: Install Dependencies Across Monorepo
```bash
pnpm install
```

### Step 2: Build Shared Contracts & Core Packages
```bash
pnpm run build
# Compiles @krypton/shared-types, @krypton/agent-runtime, and @krypton/cli
```

### Step 3: Compile Standalone Native Sidecars (Daemon & CLI)
```bash
pnpm run build:binaries
```
This triggers `scripts/build-sidecar.mjs` and `scripts/build-cli.mjs`, outputting binaries directly into `apps/desktop/src-tauri/binaries/`.

To target a specific operating system or architecture:
```bash
# Windows x64
pnpm run build:binaries:win

# macOS Apple Silicon (ARM64)
pnpm run build:binaries:mac

# macOS Intel (x64)
pnpm run build:binaries:mac-intel

# Linux x86_64
pnpm run build:binaries:linux
```

### Step 4: Build Desktop Application & Harvest Release Package
```bash
pnpm run build:desktop
```
Invokes Tauri's bundler and runs `scripts/collect-output.mjs`, producing the single unified installer in `output/`.

---

## 3. Local Development Mode Commands

| Command | Action |
| :--- | :--- |
| `pnpm dev` | Starts Next.js frontend dev server (`apps/desktop`) |
| `pnpm dev:tauri` | Launches full desktop app in development with hot reloading |
| `pnpm dev:daemon` | Runs agent runtime daemon with file watcher |
| `pnpm dev:cli` | Launches Ink CLI directly against running daemon |
| `pnpm typecheck` | Validates TypeScript types across all workspace packages |
| `pnpm test:all` | Runs Vitest suites across all packages and checks Cargo crate |

# Security Policy

The Krypton team takes the security and integrity of the **Krypton** autonomous desktop AI agent runtime seriously. Because Krypton executes code, automates desktop tasks, controls browser instances, and interacts with local developer environments, our architecture is built around local-first isolation and strict defense-in-depth security principles.

This document outlines supported versions, vulnerability reporting procedures, and our core security model.

---

## Supported Versions

Security updates are actively provided for the following releases:

| Version | Supported | Notes |
| :--- | :--- | :--- |
| `1.x` | :white_check_mark: | Current active release line |
| `< 1.0` | :x: | Experimental / deprecated pre-releases |

---

## Reporting a Vulnerability

If you discover a security vulnerability in Krypton, **please do not disclose it publicly** by creating a public issue, pull request, or discussion.

Instead, please report vulnerabilities privately using one of the following methods:

### Method 1: GitHub Private Vulnerability Reporting (Recommended)
Submit a report directly via the GitHub Security Advisory system:
👉 **[New Security Advisory](https://github.com/Istiyaq-Khan/krypton/security/advisories/new)**

### Method 2: Direct Security Email
Email the maintainers directly:
📧 **`istiyaqkhanr@gmail.com`**  
Subject line: `[SECURITY] Vulnerability Report: Krypton - <brief title>`

### What to Include in Your Report
To help us triage and resolve the issue quickly, please provide:
1. A clear description of the vulnerability and its potential impact.
2. Step-by-step reproduction instructions or a minimal Proof of Concept (PoC).
3. The platform(s) affected (Windows, macOS, Linux).
4. Any potential remediations or suggested fixes you have identified.

### Response SLA & Coordinated Disclosure
- **Initial Acknowledgment**: Within **48 hours** of receipt.
- **Triage & Assessment**: Within **5 business days**, confirming reproduction and assigning severity.
- **Remediation & Patching**: We strive to publish patches for verified vulnerabilities within **14 to 30 days**.
- **Coordinated Disclosure**: We will collaborate with you on a mutual public disclosure timeline and acknowledge your contribution in release notes (unless anonymity is requested).

---

## Krypton Defense-in-Depth Security Architecture

Krypton is architected to protect host operating systems and user codebases from untrusted, automated agent behavior:

### 1. Local-First & Zero Telemetry
- All configurations, agent memory, task DAGs, and credentials reside strictly on your local disk inside `~/.krypton` (`%USERPROFILE%\.krypton`).
- Zero telemetry, analytics, or external server telemetry is transmitted.

### 2. Static AST Linter & Safety Interceptor
- Synthesized JavaScript, TypeScript, and Python code is analyzed by Krypton's static AST linter (`packages/agent-runtime/src/sandbox/linter.ts`) prior to execution.
- Destructive and unconstrained operations are blocked by default:
  - Destructive filesystem wiping (`rm -rf /`, `del /s /q`, raw root directory access).
  - Unsanctioned subprocess spawning (`os.system`, `child_process.exec`, `subprocess.Popen`).
  - Dynamic `eval()` and unsanitized string execution.

### 3. Subprocess Sandboxing & Ephemeral Workspaces
- Terminal and script executions run in constrained subprocess environments (Windows Job Objects on Windows, `rlimit` constraints on POSIX systems).
- File operations are scoped to ephemeral workspaces (`~/.krypton/sandbox_workspace/<exec-id>`), preventing silent mutation of parent directories.

### 4. Krypton-VCS Worktree Isolation
- Autonomous code modifications execute strictly within isolated Git worktrees (`~/.krypton/worktrees/<task-id>`).
- Direct modification of active user branches is strictly prohibited.
- Merging agent worktrees into your working branch requires visual diff review and explicit human approval.

### 5. Hardware-Backed Vault & Native Keyring
- User API keys, provider tokens, and channel bot credentials are protected using native OS keychains (Windows Credential Manager, macOS Keychain, Linux Secret Service).
- Stored secrets are encrypted at rest using AES-256-GCM.

### 6. Stealth Browser Isolation
- Browser automation instances enforce a strict concurrency cap (maximum 2 active contexts) in `BrowserContextPool`.
- Contexts idle for $>15$ minutes are automatically purged and recycled, wiping session storage and memory.

---

## In-Scope vs. Out-of-Scope

### In-Scope Vulnerabilities
- Sandbox escapes allowing commands to execute outside `~/.krypton/sandbox_workspace/`.
- AST linter bypasses resulting in execution of banned hazardous system calls.
- Arbitrary code execution (RCE) via IPC or WebSocket message injection.
- Unauthenticated access to the local daemon IPC or platform named pipes.
- Memory corruption or privilege escalation in Tauri v2 native core commands.
- Extraction of unencrypted API keys or vault credentials.

### Out-of-Scope
- Attacks requiring existing root / administrator access to the target host system.
- Attacks requiring physical access to an unlocked host machine.
- Social engineering attacks against maintainers or contributors.
- Vulnerabilities in third-party LLM providers (OpenAI, Anthropic, Ollama, etc.) unrelated to Krypton's runtime code.

---

## Safe Harbor

We consider security research conducted under this policy to be authorized:
- We will not pursue legal action against researchers acting in good faith.
- We ask that you avoid privacy violations, destruction of user data, and disruption of community infrastructure.

Thank you for helping keep Krypton and its users secure! 🛡️

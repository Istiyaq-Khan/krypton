# Krypton Autonomous Implementation Plan (`IMPLEMENTATION_PLAN.md`)

This living document serves as the mandatory operational implementation ledger established under **Rule 2** of [`AGENTS.md`](AGENTS.md). 

Every autonomous agent or human contributor **MUST** create and update this document in the root of the repository immediately following initial research and prior to modifying codebase files.

---

## 1. Task Metadata & Scope

| Field | Value |
| :--- | :--- |
| **Feature / Task Name** | Operational Protocol Hardening: Five Golden Rules & Root Plan Standard |
| **Status** | In Progress (Validation Phase) |
| **Target Packages** | Root workspace, `docs/` |
| **Primary Branch** | `master` |
| **Pre-Flight Research Ref** | [`AGENTS.md`](AGENTS.md), [`docs/INDEX.md`](docs/INDEX.md), [`docs/architecture/full-architecture.md`](docs/architecture/full-architecture.md) |

---

## 2. Architectural Impact & Pre-Flight Analysis

- **Governance Alignment**: Expand the operational protocol from four to five invariant rules, explicitly codifying that an implementation plan markdown artifact must be generated in the root directory before applying code modifications.
- **Repository Standard**: Ensures any AI agent interacting with Krypton leaves an explicit, auditable implementation plan ledger that prevents context loss between interruptions or sub-agent handoffs.
- **Documentation Parity**: Synchronize architectural references across [`docs/architecture/full-architecture.md`](docs/architecture/full-architecture.md) and [`AGENTS.md`](AGENTS.md).

---

## 3. Concrete File Modifications & Actions

- [x] **Update Operational Standard**:
  - File: [`AGENTS.md`](AGENTS.md)
  - Action: Update Section 1 to "The Five Golden Operational Rules". Insert Rule 2: Root Implementation Plan Artifact (`IMPLEMENTATION_PLAN.md`). Shift subsequent rules to Rules 3, 4, and 5.
- [x] **Synchronize Full Architecture Governance**:
  - File: [`docs/architecture/full-architecture.md`](docs/architecture/full-architecture.md)
  - Action: Update Section 8 (Verification & Architectural Governance) to reflect the Five Golden Operational Rules.
- [x] **Initialize Root Implementation Ledger**:
  - File: [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md)
  - Action: Scaffold living implementation template demonstrating objectives, architecture decisions, line references, verification gates, and progress tracking.

---

## 4. Multi-Tier Verification Gates

| Gate | Target Command | Acceptance Criteria | Status |
| :--- | :--- | :--- | :--- |
| **1. Monorepo Typecheck** | `pnpm run typecheck` | 0 type errors across all packages | Verified ✅ |
| **2. Monorepo Automated Tests** | `pnpm run test:all` | 46 test files, 348 tests pass | Verified ✅ |
| **3. Rust Native Core** | `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` | 0 compilation errors | Verified ✅ |
| **4. Documentation Zero-Drift** | Internal links check | Zero broken references to Golden Rules | Verified ✅ |

---

## 5. Execution Progress Ledger

- [x] Phase 1: Pre-flight audit of `AGENTS.md` and related architectural documentation.
- [x] Phase 2: Authoring `IMPLEMENTATION_PLAN.md` standard and rule definition in `AGENTS.md`.
- [x] Phase 3: Synchronizing architectural documentation in `docs/architecture/full-architecture.md`.
- [x] Phase 4: Full verification gate execution (`pnpm run typecheck`, `pnpm run test:all`).
- [ ] Phase 5: Final review and handoff.

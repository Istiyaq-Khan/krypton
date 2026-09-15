import {
  VerificationStatus,
  TrajectoryVerificationDetails,
} from "@krypton/shared-types";
import { TaskTree } from "../planner/task-tree.js";
import { DynamicReplanner } from "../planner/replanner.js";

export interface VerificationContext {
  taskId: string;
  agentId: string;
  worktreePath?: string;
  changedFiles?: string[];
  metadata?: Record<string, unknown>;
}

export interface VerificationCheckResult {
  name: string;
  passed: boolean;
  diagnostics?: string;
  durationMs: number;
}

export interface VerificationOutcome {
  passed: boolean;
  status: VerificationStatus;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  diagnostics?: string;
  details: TrajectoryVerificationDetails;
  results: VerificationCheckResult[];
}

export type VerificationCheckFn = (
  context: VerificationContext
) => Promise<{ passed: boolean; diagnostics?: string }>;

/**
 * Pre-Completion Verification Harness (Prime-Agent Pattern).
 * Enforces automated quality and safety gates (linter, compiler typecheck, unit test assertion)
 * before any task is permitted to transition to 'completed'.
 * On failure, automatically transitions task to 'failed' and triggers DynamicReplanner.
 */
export class PreCompletionVerifier {
  private checks = new Map<string, VerificationCheckFn>();

  /**
   * Registers a verification check rule or test suite.
   */
  public registerCheck(name: string, checkFn: VerificationCheckFn): void {
    this.checks.set(name, checkFn);
  }

  public unregisterCheck(name: string): void {
    this.checks.delete(name);
  }

  /**
   * Runs all registered verification checks against the context.
   */
  public async verify(
    context: VerificationContext,
    options?: {
      tree?: TaskTree;
      replanner?: DynamicReplanner;
    }
  ): Promise<VerificationOutcome> {
    const results: VerificationCheckResult[] = [];
    let passedChecks = 0;
    let failedChecks = 0;
    const diagnosticLines: string[] = [];

    for (const [name, checkFn] of this.checks.entries()) {
      const startTime = Date.now();
      try {
        const res = await checkFn(context);
        const durationMs = Date.now() - startTime;

        if (res.passed) {
          passedChecks++;
          results.push({ name, passed: true, durationMs });
        } else {
          failedChecks++;
          const diag = res.diagnostics || `Check '${name}' failed assertion`;
          diagnosticLines.push(`[${name}]: ${diag}`);
          results.push({ name, passed: false, diagnostics: diag, durationMs });
        }
      } catch (err: any) {
        failedChecks++;
        const diag = err?.message || String(err);
        diagnosticLines.push(`[${name} Exception]: ${diag}`);
        results.push({
          name,
          passed: false,
          diagnostics: diag,
          durationMs: Date.now() - startTime,
        });
      }
    }

    const passed = failedChecks === 0;
    const status: VerificationStatus = passed ? "passed" : "failed";
    const combinedDiagnostics =
      diagnosticLines.length > 0 ? diagnosticLines.join("\n") : undefined;

    const details: TrajectoryVerificationDetails = {
      suiteName: "PreCompletionHarness",
      passedChecks,
      failedChecks,
      diagnostics: combinedDiagnostics,
    };

    const outcome: VerificationOutcome = {
      passed,
      status,
      totalChecks: this.checks.size,
      passedChecks,
      failedChecks,
      diagnostics: combinedDiagnostics,
      details,
      results,
    };

    // If verification failed and tree/replanner are provided, trigger dynamic replanning
    if (!passed && options?.tree && options?.replanner) {
      options.replanner.handleFailure({
        tree: options.tree,
        failedTaskId: context.taskId,
        errorDiagnostics: combinedDiagnostics || "Pre-completion verification checks failed",
      });
    }

    return outcome;
  }
}

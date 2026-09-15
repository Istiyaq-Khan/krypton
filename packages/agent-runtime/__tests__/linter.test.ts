import { describe, it, expect } from "vitest";
import {
  lintTypeScript,
  lintPython,
  lintCode,
  createClarificationFromLint,
} from "../src/index.js";

describe("Phase 2 Verification Gate: AST Safety Linter", () => {
  describe("TypeScript/JavaScript AST Safety Inspection", () => {
    it("permits safe TypeScript code", () => {
      const safeCode = `
        export function add(a: number, b: number): number {
          return a + b;
        }
        console.log(add(10, 20));
      `;
      const result = lintTypeScript(safeCode);
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.requiresClarification).toBe(false);
    });

    it("blocks hazardous module imports (child_process, cluster, worker_threads, vm)", () => {
      const maliciousCode = `
        import * as cp from "child_process";
        cp.exec("whoami");
      `;
      const result = lintTypeScript(maliciousCode);
      expect(result.allowed).toBe(false);
      expect(result.violations.some((v) => v.rule === "no-hazardous-imports")).toBe(true);
    });

    it("blocks require('child_process')", () => {
      const maliciousCode = `
        const cp = require("child_process");
        cp.spawn("bash");
      `;
      const result = lintTypeScript(maliciousCode);
      expect(result.allowed).toBe(false);
      expect(result.violations.some((v) => v.rule === "no-hazardous-imports")).toBe(true);
    });

    it("blocks dynamic eval() and new Function() calls", () => {
      const evalCode = `
        const payload = "alert(1)";
        eval(payload);
      `;
      const resultEval = lintTypeScript(evalCode);
      expect(resultEval.allowed).toBe(false);
      expect(resultEval.violations.some((v) => v.rule === "no-eval")).toBe(true);

      const fnCode = `
        const dynamicFn = new Function("a", "return a * 2;");
      `;
      const resultFn = lintTypeScript(fnCode);
      expect(resultFn.allowed).toBe(false);
      expect(resultFn.violations.some((v) => v.rule === "no-new-function")).toBe(true);
    });

    it("blocks process.exit() calls", () => {
      const exitCode = `
        console.log("fatal");
        process.exit(1);
      `;
      const result = lintTypeScript(exitCode);
      expect(result.allowed).toBe(false);
      expect(result.violations.some((v) => v.rule === "no-process-exit")).toBe(true);
    });

    it("blocks destructive root wipes (rmSync('/'))", () => {
      const wipeCode = `
        import * as fs from "fs";
        fs.rmSync("/", { recursive: true });
      `;
      const result = lintTypeScript(wipeCode);
      expect(result.allowed).toBe(false);
      expect(result.violations.some((v) => v.rule === "no-root-filesystem-wipe")).toBe(true);
    });
  });

  describe("Python AST Safety Inspection", () => {
    it("permits safe Python code", () => {
      const safePy = `
def compute(x):
    return [i * 2 for i in range(x)]

print(compute(5))
`;
      const result = lintPython(safePy);
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("blocks os.system calls", () => {
      const maliciousPy = `
import os
os.system("rm -rf /")
`;
      const result = lintPython(maliciousPy);
      expect(result.allowed).toBe(false);
      expect(result.violations.some((v) => v.rule === "no-os-system")).toBe(true);
    });

    it("blocks subprocess executions (Popen, run, call)", () => {
      const maliciousPy = `
import subprocess
subprocess.Popen(["bash", "-i"])
`;
      const result = lintPython(maliciousPy);
      expect(result.allowed).toBe(false);
      expect(result.violations.some((v) => v.rule === "no-subprocess")).toBe(true);
    });

    it("blocks destructive shutil.rmtree('/')", () => {
      const maliciousPy = `
import shutil
shutil.rmtree('/')
`;
      const result = lintPython(maliciousPy);
      expect(result.allowed).toBe(false);
      expect(result.violations.some((v) => v.rule === "no-root-wipe")).toBe(true);
    });
  });

  describe("Clarification Escalation Bridge", () => {
    it("generates a structured ClarificationRequest on rejected script", () => {
      const code = `eval("2 + 2")`;
      const lint = lintCode("typescript", code);
      const agentId = "11111111-1111-4111-a111-111111111111";

      const clarification = createClarificationFromLint(agentId, "eval_runner.ts", lint);
      expect(clarification).not.toBeNull();
      expect(clarification?.agentId).toBe(agentId);
      expect(clarification?.prompt).toContain("eval_runner.ts");
      expect(clarification?.options).toHaveLength(2);
      expect(clarification?.options[0]?.id).toBe("reject");
    });
  });
});

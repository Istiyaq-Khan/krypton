import ts from "typescript";
import { ClarificationRequest } from "@krypton/shared-types";

export interface LintViolation {
  rule: string;
  message: string;
  line?: number;
  severity: "fatal" | "warning";
}

export interface LintResult {
  allowed: boolean;
  violations: LintViolation[];
  requiresClarification: boolean;
  clarificationPrompt?: string;
}

const BANNED_TS_MODULES = new Set([
  "child_process",
  "cluster",
  "worker_threads",
  "vm",
]);

const DANGEROUS_FS_PATHS = [
  "/",
  "/*",
  "C:\\",
  "C:/",
  "C:\\Windows",
  "C:/Windows",
  "/etc",
  "/usr",
  "/var",
  "/bin",
  "/sbin",
];

/**
 * Validates TypeScript or JavaScript source code using the TypeScript Compiler AST API.
 */
export function lintTypeScript(code: string): LintResult {
  const violations: LintViolation[] = [];
  const sourceFile = ts.createSourceFile(
    "synthesized.ts",
    code,
    ts.ScriptTarget.Latest,
    true
  );

  function getLine(pos: number): number {
    return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
  }

  function checkDestructivePath(node: ts.Node, argText: string): void {
    const cleanArg = argText.replace(/['"`]/g, "").trim();
    if (DANGEROUS_FS_PATHS.some((p) => cleanArg === p || cleanArg.startsWith(p + "/"))) {
      violations.push({
        rule: "no-root-filesystem-wipe",
        message: `Destructive filesystem operation on critical system path: "${cleanArg}"`,
        line: getLine(node.getStart()),
        severity: "fatal",
      });
    }
  }

  function visit(node: ts.Node): void {
    // 1. Check imports: import ... from 'child_process'
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        if (BANNED_TS_MODULES.has(moduleSpecifier.text)) {
          violations.push({
            rule: "no-hazardous-imports",
            message: `Importing hazardous module "${moduleSpecifier.text}" is prohibited in sandboxed agents`,
            line: getLine(node.getStart()),
            severity: "fatal",
          });
        }
      }
    }

    // 2. Check require calls: require('child_process')
    if (ts.isCallExpression(node)) {
      const expression = node.expression;

      // require('...')
      if (ts.isIdentifier(expression) && expression.text === "require") {
        const firstArg = node.arguments[0];
        if (firstArg && ts.isStringLiteral(firstArg)) {
          if (BANNED_TS_MODULES.has(firstArg.text)) {
            violations.push({
              rule: "no-hazardous-imports",
              message: `Requiring hazardous module "${firstArg.text}" is prohibited`,
              line: getLine(node.getStart()),
              severity: "fatal",
            });
          }
        }
      }

      // eval(...)
      if (ts.isIdentifier(expression) && expression.text === "eval") {
        violations.push({
          rule: "no-eval",
          message: "Dynamic eval() execution is strictly banned",
          line: getLine(node.getStart()),
          severity: "fatal",
        });
      }

      // process.exit(...)
      if (ts.isPropertyAccessExpression(expression)) {
        const obj = expression.expression;
        const prop = expression.name;
        if (ts.isIdentifier(obj) && obj.text === "process" && prop.text === "exit") {
          violations.push({
            rule: "no-process-exit",
            message: "Direct process.exit() calls are prohibited in sandboxed scripts",
            line: getLine(node.getStart()),
            severity: "fatal",
          });
        }

        // Destructive fs methods: rmSync, rmdirSync, unlinkSync
        const destructiveFsMethods = ["rmSync", "rmdirSync", "unlinkSync", "rm", "rmdir"];
        if (destructiveFsMethods.includes(prop.text)) {
          const firstArg = node.arguments[0];
          if (firstArg) {
            checkDestructivePath(node, firstArg.getText(sourceFile));
          }
        }
      }
    }

    // 3. Check new Function(...)
    if (ts.isNewExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === "Function") {
        violations.push({
          rule: "no-new-function",
          message: "Dynamic new Function() constructor execution is strictly banned",
          line: getLine(node.getStart()),
          severity: "fatal",
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  const hasFatal = violations.some((v) => v.severity === "fatal");
  return {
    allowed: !hasFatal,
    violations,
    requiresClarification: hasFatal,
    clarificationPrompt: hasFatal
      ? `The synthesized TypeScript script contains flagged operations:\n${violations
          .map((v) => `- [${v.rule}] ${v.message}`)
          .join("\n")}`
      : undefined,
  };
}

/**
 * Validates Python source code for hazardous system calls and destructive disk wipes.
 */
export function lintPython(code: string): LintResult {
  const violations: LintViolation[] = [];
  const lines = code.split("\n");

  const bannedPatterns = [
    { pattern: /\bos\.system\s*\(/, rule: "no-os-system", message: "os.system() call is prohibited" },
    { pattern: /\bsubprocess\.(Popen|run|call|check_output)\s*\(/, rule: "no-subprocess", message: "Raw subprocess execution is prohibited" },
    { pattern: /\bpty\.spawn\s*\(/, rule: "no-pty-spawn", message: "pty.spawn() execution is prohibited" },
    { pattern: /\b(eval|exec)\s*\(/, rule: "no-eval-exec", message: "Dynamic eval()/exec() is prohibited" },
    { pattern: /shutil\.rmtree\s*\(\s*['"](\/|C:\\?|C:\/|C:\\Windows)['"]\s*\)/, rule: "no-root-wipe", message: "Destructive root directory wipe is prohibited" },
    { pattern: /socket\.(bind|listen)\s*\(/, rule: "no-raw-socket-bind", message: "Raw socket server binding is restricted in sandbox" },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || "";
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) continue;

    for (const item of bannedPatterns) {
      if (item.pattern.test(line)) {
        violations.push({
          rule: item.rule,
          message: item.message,
          line: i + 1,
          severity: "fatal",
        });
      }
    }
  }

  const hasFatal = violations.some((v) => v.severity === "fatal");
  return {
    allowed: !hasFatal,
    violations,
    requiresClarification: hasFatal,
    clarificationPrompt: hasFatal
      ? `The synthesized Python script contains flagged operations:\n${violations
          .map((v) => `- [${v.rule}] ${v.message}`)
          .join("\n")}`
      : undefined,
  };
}

/**
 * Validates code according to specified language.
 */
export function lintCode(language: "python" | "typescript" | "javascript", code: string): LintResult {
  if (language === "python") {
    return lintPython(code);
  }
  return lintTypeScript(code);
}

/**
 * Creates a human-in-the-loop ClarificationRequest when a script fails the AST safety linter.
 */
export function createClarificationFromLint(
  agentId: string,
  scriptName: string,
  lintResult: LintResult,
  taskId?: string
): ClarificationRequest | null {
  if (lintResult.allowed) return null;

  return {
    requestId: crypto.randomUUID(),
    agentId,
    taskId,
    prompt: `Security Warning: Script "${scriptName}" triggered static AST safety violations:\n\n${lintResult.violations
      .map((v) => `• [Line ${v.line || "?"}] ${v.message}`)
      .join("\n")}\n\nDo you wish to permit this execution?`,
    options: [
      {
        id: "reject",
        label: "Reject & Abort Script",
        description: "Block the script and request self-correction",
        hotkey: "1",
        isRecommended: true,
      },
      {
        id: "approve_once",
        label: "Allow Once (Risk Acknowledged)",
        description: "Override AST linter and execute inside sandbox jail",
        hotkey: "2",
        isRecommended: false,
      },
    ],
    allowFreeform: false,
    timeoutMs: 60_000,
    status: "pending",
    createdAt: Date.now(),
  };
}

import * as fs from "node:fs";
import * as path from "node:path";
import {
  CodeSymbol,
  CodeSymbolKind,
  ImportGraphEdge,
  RepositoryIndex,
} from "@krypton/shared-types";

export interface IndexDirectoryOptions {
  extensions?: string[];
  ignoreDirs?: string[];
  maxFiles?: number;
}

const DEFAULT_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".rs",
  ".go",
];

const DEFAULT_IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "target",
  ".next",
  "__pycache__",
  ".idea",
  ".krypton",
]);

/**
 * High-performance AST symbol parser and repository indexer supporting
 * TypeScript, JavaScript, Python, Rust, and Go with zero native compilation overhead.
 */
export class TreeSitterSymbolParser {
  /**
   * Parses source code file into structured symbols and import graph edges.
   */
  public static parseFile(
    filePath: string,
    fileContent?: string
  ): { symbols: CodeSymbol[]; imports: ImportGraphEdge[] } {
    const ext = path.extname(filePath).toLowerCase();
    const content =
      fileContent !== undefined
        ? fileContent
        : fs.existsSync(filePath)
        ? fs.readFileSync(filePath, "utf-8")
        : "";

    switch (ext) {
      case ".ts":
      case ".tsx":
      case ".js":
      case ".jsx":
        return this.parseTypeScript(filePath, content);
      case ".py":
        return this.parsePython(filePath, content);
      case ".rs":
        return this.parseRust(filePath, content);
      case ".go":
        return this.parseGo(filePath, content);
      default:
        return { symbols: [], imports: [] };
    }
  }

  /**
   * Recursively indexes all supported source files in a directory to produce a unified RepositoryIndex.
   */
  public static async indexDirectory(
    dirPath: string,
    options: IndexDirectoryOptions = {}
  ): Promise<RepositoryIndex> {
    const startTime = Date.now();
    const resolvedRoot = path.resolve(dirPath);
    const targetExts = new Set(options.extensions || DEFAULT_EXTENSIONS);
    const ignoreDirs = new Set(options.ignoreDirs || DEFAULT_IGNORE_DIRS);
    const maxFiles = options.maxFiles || 5_000;

    const allSymbols: CodeSymbol[] = [];
    const allImports: ImportGraphEdge[] = [];
    const languagesFound = new Set<string>();
    let totalFiles = 0;

    const walk = (currentDir: string) => {
      if (totalFiles >= maxFiles) return;

      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!ignoreDirs.has(entry.name)) {
            walk(path.join(currentDir, entry.name));
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (targetExts.has(ext)) {
            totalFiles++;
            const fullPath = path.join(currentDir, entry.name);
            const { symbols, imports } = this.parseFile(fullPath);

            allSymbols.push(...symbols);
            allImports.push(...imports);

            if ([".ts", ".tsx"].includes(ext)) languagesFound.add("typescript");
            else if ([".js", ".jsx"].includes(ext)) languagesFound.add("javascript");
            else if (ext === ".py") languagesFound.add("python");
            else if (ext === ".rs") languagesFound.add("rust");
            else if (ext === ".go") languagesFound.add("go");
          }
        }
      }
    };

    if (fs.existsSync(resolvedRoot)) {
      walk(resolvedRoot);
    }

    return {
      rootPath: resolvedRoot,
      totalFiles,
      symbols: allSymbols,
      imports: allImports,
      indexedLanguages: Array.from(languagesFound),
      durationMs: Date.now() - startTime,
    };
  }

  private static createSymbol(data: {
    name: string;
    kind: CodeSymbolKind;
    filePath: string;
    startLine: number;
    endLine: number;
    startColumn?: number;
    endColumn?: number;
    signature?: string;
    isExported?: boolean;
    docComment?: string;
  }): CodeSymbol {
    return {
      name: data.name,
      kind: data.kind,
      filePath: data.filePath,
      startLine: data.startLine,
      endLine: data.endLine,
      startColumn: data.startColumn ?? 0,
      endColumn: data.endColumn ?? 0,
      signature: data.signature ?? "",
      isExported: data.isExported ?? false,
      docComment: data.docComment,
    };
  }

  /**
   * Fast regex-based AST symbol extraction for TypeScript / JavaScript.
   */
  private static parseTypeScript(
    filePath: string,
    content: string
  ): { symbols: CodeSymbol[]; imports: ImportGraphEdge[] } {
    const symbols: CodeSymbol[] = [];
    const imports: ImportGraphEdge[] = [];
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const lineNum = i + 1;

      // 1. Imports: import { a, b } from "path"
      const importMatch = trimmed.match(/^import\s+(?:type\s+)?(?:(\*\s+as\s+\w+)|(?:\{([^}]+)\})|(\w+))\s+from\s+['"]([^'"]+)['"]/);
      if (importMatch) {
        const isTypeOnly = trimmed.startsWith("import type");
        const toPath = importMatch[4];
        let importedSymbols: string[] = [];

        if (importMatch[2]) {
          importedSymbols = importMatch[2].split(",").map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
        } else if (importMatch[3]) {
          importedSymbols = [importMatch[3]];
        } else if (importMatch[1]) {
          importedSymbols = [importMatch[1]];
        }

        imports.push({
          fromPath: filePath,
          toPath,
          importedSymbols,
          isTypeOnly,
        });
        continue;
      }

      const isExported = trimmed.startsWith("export ");

      // 2. Classes & Interfaces
      const classMatch = trimmed.match(/^(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_$]+)/);
      if (classMatch) {
        symbols.push(this.createSymbol({
          name: classMatch[1],
          kind: "class",
          filePath,
          startLine: lineNum,
          endLine: lineNum,
          signature: trimmed.split("{")[0].trim(),
          isExported,
        }));
        continue;
      }

      const ifaceMatch = trimmed.match(/^(?:export\s+)?interface\s+([A-Za-z0-9_$]+)/);
      if (ifaceMatch) {
        symbols.push(this.createSymbol({
          name: ifaceMatch[1],
          kind: "interface",
          filePath,
          startLine: lineNum,
          endLine: lineNum,
          signature: trimmed.split("{")[0].trim(),
          isExported,
        }));
        continue;
      }

      // 3. Types
      const typeMatch = trimmed.match(/^(?:export\s+)?type\s+([A-Za-z0-9_$]+)\s*=/);
      if (typeMatch) {
        symbols.push(this.createSymbol({
          name: typeMatch[1],
          kind: "type",
          filePath,
          startLine: lineNum,
          endLine: lineNum,
          signature: trimmed,
          isExported,
        }));
        continue;
      }

      // 4. Functions
      const funcMatch = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/);
      if (funcMatch) {
        symbols.push(this.createSymbol({
          name: funcMatch[1],
          kind: "function",
          filePath,
          startLine: lineNum,
          endLine: lineNum,
          signature: trimmed.split("{")[0].trim(),
          isExported,
        }));
        continue;
      }

      // 5. Arrow functions / Variable functions: const foo = (...) =>
      const arrowMatch = trimmed.match(/^(?:export\s+)?(?:const|let)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>/);
      if (arrowMatch) {
        symbols.push(this.createSymbol({
          name: arrowMatch[1],
          kind: "function",
          filePath,
          startLine: lineNum,
          endLine: lineNum,
          signature: trimmed.split("=>")[0].trim() + " =>",
          isExported,
        }));
      }
    }

    return { symbols, imports };
  }

  /**
   * Fast regex-based AST symbol extraction for Python.
   */
  private static parsePython(
    filePath: string,
    content: string
  ): { symbols: CodeSymbol[]; imports: ImportGraphEdge[] } {
    const symbols: CodeSymbol[] = [];
    const imports: ImportGraphEdge[] = [];
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const lineNum = i + 1;

      // Imports: import x or from x import y
      const fromImportMatch = trimmed.match(/^from\s+([A-Za-z0-9_.]+)\s+import\s+(.+)$/);
      if (fromImportMatch) {
        const importedSymbols = fromImportMatch[2].split(",").map((s) => s.trim()).filter(Boolean);
        imports.push({
          fromPath: filePath,
          toPath: fromImportMatch[1],
          importedSymbols,
          isTypeOnly: false,
        });
        continue;
      }

      const importMatch = trimmed.match(/^import\s+([A-Za-z0-9_.,\s]+)$/);
      if (importMatch) {
        const pkgs = importMatch[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
        for (const pkg of pkgs) {
          imports.push({
            fromPath: filePath,
            toPath: pkg,
            importedSymbols: [pkg],
            isTypeOnly: false,
          });
        }
        continue;
      }

      // Classes: class Foo(Bar):
      const classMatch = trimmed.match(/^class\s+([A-Za-z0-9_]+)(?:\(([^)]*)\))?:/);
      if (classMatch) {
        symbols.push(this.createSymbol({
          name: classMatch[1],
          kind: "class",
          filePath,
          startLine: lineNum,
          endLine: lineNum,
          signature: trimmed.replace(/:$/, ""),
          isExported: !classMatch[1].startsWith("_"),
        }));
        continue;
      }

      // Functions & Methods: def foo(...):
      const defMatch = trimmed.match(/^(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/);
      if (defMatch) {
        const isMethod = line.startsWith("    ") || line.startsWith("\t");
        symbols.push(this.createSymbol({
          name: defMatch[1],
          kind: isMethod ? "method" : "function",
          filePath,
          startLine: lineNum,
          endLine: lineNum,
          signature: trimmed.replace(/:$/, ""),
          isExported: !defMatch[1].startsWith("_"),
        }));
      }
    }

    return { symbols, imports };
  }

  /**
   * Fast regex-based AST symbol extraction for Rust.
   */
  private static parseRust(
    filePath: string,
    content: string
  ): { symbols: CodeSymbol[]; imports: ImportGraphEdge[] } {
    const symbols: CodeSymbol[] = [];
    const imports: ImportGraphEdge[] = [];
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const lineNum = i + 1;

      // use crate::foo::bar;
      const useMatch = trimmed.match(/^use\s+([^;]+);/);
      if (useMatch) {
        imports.push({
          fromPath: filePath,
          toPath: useMatch[1],
          importedSymbols: [useMatch[1].split("::").pop() || ""],
          isTypeOnly: false,
        });
        continue;
      }

      const isExported = trimmed.startsWith("pub ");

      // fn
      const fnMatch = trimmed.match(/^(?:pub(?:\([^)]+\))?\s+)?(?:async\s+)?fn\s+([A-Za-z0-9_]+)\s*(?:<[^>]+>)?\s*\(/);
      if (fnMatch) {
        symbols.push(this.createSymbol({
          name: fnMatch[1],
          kind: "function",
          filePath,
          startLine: lineNum,
          endLine: lineNum,
          signature: trimmed.split("{")[0].trim(),
          isExported,
        }));
        continue;
      }

      // struct
      const structMatch = trimmed.match(/^(?:pub(?:\([^)]+\))?\s+)?struct\s+([A-Za-z0-9_]+)/);
      if (structMatch) {
        symbols.push(this.createSymbol({
          name: structMatch[1],
          kind: "class",
          filePath,
          startLine: lineNum,
          endLine: lineNum,
          signature: trimmed.split("{")[0].trim(),
          isExported,
        }));
        continue;
      }

      // enum
      const enumMatch = trimmed.match(/^(?:pub(?:\([^)]+\))?\s+)?enum\s+([A-Za-z0-9_]+)/);
      if (enumMatch) {
        symbols.push(this.createSymbol({
          name: enumMatch[1],
          kind: "enum",
          filePath,
          startLine: lineNum,
          endLine: lineNum,
          signature: trimmed.split("{")[0].trim(),
          isExported,
        }));
        continue;
      }

      // trait
      const traitMatch = trimmed.match(/^(?:pub(?:\([^)]+\))?\s+)?trait\s+([A-Za-z0-9_]+)/);
      if (traitMatch) {
        symbols.push(this.createSymbol({
          name: traitMatch[1],
          kind: "interface",
          filePath,
          startLine: lineNum,
          endLine: lineNum,
          signature: trimmed.split("{")[0].trim(),
          isExported,
        }));
      }
    }

    return { symbols, imports };
  }

  /**
   * Fast regex-based AST symbol extraction for Go.
   */
  private static parseGo(
    filePath: string,
    content: string
  ): { symbols: CodeSymbol[]; imports: ImportGraphEdge[] } {
    const symbols: CodeSymbol[] = [];
    const imports: ImportGraphEdge[] = [];
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const lineNum = i + 1;

      // func
      const funcMatch = trimmed.match(/^func\s+(?:\([^)]+\)\s+)?([A-Za-z0-9_]+)\s*\(/);
      if (funcMatch) {
        const name = funcMatch[1];
        const isExported = name[0] === name[0].toUpperCase();
        symbols.push(this.createSymbol({
          name,
          kind: "function",
          filePath,
          startLine: lineNum,
          endLine: lineNum,
          signature: trimmed.split("{")[0].trim(),
          isExported,
        }));
        continue;
      }

      // type Struct / Interface
      const typeMatch = trimmed.match(/^type\s+([A-Za-z0-9_]+)\s+(struct|interface)/);
      if (typeMatch) {
        const name = typeMatch[1];
        const isExported = name[0] === name[0].toUpperCase();
        symbols.push(this.createSymbol({
          name,
          kind: typeMatch[2] === "struct" ? "class" : "interface",
          filePath,
          startLine: lineNum,
          endLine: lineNum,
          signature: trimmed.split("{")[0].trim(),
          isExported,
        }));
      }
    }

    return { symbols, imports };
  }
}

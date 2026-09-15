import { z } from "zod";

/**
 * Kind of code symbol discovered during Tree-sitter / AST indexing.
 */
export const CodeSymbolKindSchema = z.enum([
  "function",
  "method",
  "class",
  "interface",
  "type",
  "variable",
  "constant",
  "enum",
  "import",
  "module",
]);
export type CodeSymbolKind = z.infer<typeof CodeSymbolKindSchema>;

/**
 * Extracted code symbol with precise range and signature.
 */
export const CodeSymbolSchema = z.object({
  name: z.string(),
  kind: CodeSymbolKindSchema,
  filePath: z.string(),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  startColumn: z.number().int().nonnegative().default(0),
  endColumn: z.number().int().nonnegative().default(0),
  signature: z.string().default(""),
  isExported: z.boolean().default(false),
  docComment: z.string().optional(),
});
export type CodeSymbol = z.infer<typeof CodeSymbolSchema>;

/**
 * Directed edge in a codebase import graph.
 */
export const ImportGraphEdgeSchema = z.object({
  fromPath: z.string(),
  toPath: z.string(),
  importedSymbols: z.array(z.string()).default([]),
  isTypeOnly: z.boolean().default(false),
});
export type ImportGraphEdge = z.infer<typeof ImportGraphEdgeSchema>;

/**
 * Aggregated code intelligence index of a repository or workspace.
 */
export const RepositoryIndexSchema = z.object({
  rootPath: z.string(),
  totalFiles: z.number().int().nonnegative(),
  symbols: z.array(CodeSymbolSchema),
  imports: z.array(ImportGraphEdgeSchema),
  indexedLanguages: z.array(z.string()),
  durationMs: z.number().nonnegative(),
});
export type RepositoryIndex = z.infer<typeof RepositoryIndexSchema>;

/**
 * Language Server Protocol (LSP) diagnostic severity levels.
 */
export const LspDiagnosticSeveritySchema = z.enum([
  "error",
  "warning",
  "information",
  "hint",
]);
export type LspDiagnosticSeverity = z.infer<typeof LspDiagnosticSeveritySchema>;

/**
 * Compiler / Linter diagnostic item emitted by an LSP server.
 */
export const LspDiagnosticSchema = z.object({
  filePath: z.string(),
  range: z.object({
    start: z.object({ line: z.number().int().nonnegative(), character: z.number().int().nonnegative() }),
    end: z.object({ line: z.number().int().nonnegative(), character: z.number().int().nonnegative() }),
  }),
  severity: LspDiagnosticSeveritySchema,
  message: z.string(),
  source: z.string().optional(),
  code: z.union([z.string(), z.number()]).optional(),
});
export type LspDiagnostic = z.infer<typeof LspDiagnosticSchema>;

/**
 * LSP jump-to-definition and reference target location.
 */
export const LspLocationSchema = z.object({
  filePath: z.string(),
  line: z.number().int().nonnegative(),
  character: z.number().int().nonnegative(),
});
export type LspLocation = z.infer<typeof LspLocationSchema>;

/**
 * LSP hover type and documentation information.
 */
export const LspHoverInfoSchema = z.object({
  contents: z.string(),
  range: z.object({
    start: z.object({ line: z.number().int().nonnegative(), character: z.number().int().nonnegative() }),
    end: z.object({ line: z.number().int().nonnegative(), character: z.number().int().nonnegative() }),
  }).optional(),
});
export type LspHoverInfo = z.infer<typeof LspHoverInfoSchema>;

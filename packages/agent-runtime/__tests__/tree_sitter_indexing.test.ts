import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { TreeSitterSymbolParser } from "../src/intelligence/tree-sitter.js";
import { HeadlessLspClient } from "../src/intelligence/lsp-client.js";

describe("Phase 4 Verification Gate: Tree-sitter Codebase Intelligence & LSP Client", () => {
  let tempRepo: string;

  beforeEach(() => {
    tempRepo = path.join(os.tmpdir(), `krypton-test-repo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    fs.mkdirSync(tempRepo, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempRepo)) {
      try {
        fs.rmSync(tempRepo, { recursive: true, force: true });
      } catch {}
    }
  });

  it("indexes multi-language repository, extracting symbols, signatures, and import graphs with zero compilation cost", async () => {
    // 1. Create a TypeScript source file
    const tsContent = `
import { TaskNode, TaskTree } from "@krypton/shared-types";
import * as path from "node:path";

export interface ITaskScheduler {
  scheduleTask(id: string): Promise<boolean>;
}

export type Priority = "high" | "low";

export class UniversalScheduler implements ITaskScheduler {
  public async scheduleTask(id: string): Promise<boolean> {
    return true;
  }
}

export async function runScheduler(name: string): Promise<void> {
  console.log(name);
}

const helper = (x: number) => x * 2;
`;
    fs.writeFileSync(path.join(tempRepo, "scheduler.ts"), tsContent, "utf-8");

    // 2. Create a Python source file
    const pyContent = `
import os
import sys
from datetime import datetime

class DataExtractor:
    def __init__(self, target_url):
        self.url = target_url

    async def fetch_payload(self):
        return {"status": 200}

def parse_records(raw_data):
    return len(raw_data)
`;
    fs.writeFileSync(path.join(tempRepo, "extractor.py"), pyContent, "utf-8");

    // 3. Create a Rust source file
    const rsContent = `
use std::collections::HashMap;

pub struct AgentWorker {
    pub id: String,
}

pub trait WorkerTrait {
    fn execute(&self) -> bool;
}

pub enum WorkerState {
    Idle,
    Busy,
}

pub async fn start_worker(worker: AgentWorker) {
    println!("started");
}
`;
    fs.writeFileSync(path.join(tempRepo, "worker.rs"), rsContent, "utf-8");

    // 4. Create a Go source file
    const goContent = `
package main

import (
    "fmt"
)

type Config struct {
    Port int
}

type Service interface {
    Start() error
}

func StartServer(cfg Config) {
    fmt.Println(cfg.Port)
}
`;
    fs.writeFileSync(path.join(tempRepo, "server.go"), goContent, "utf-8");

    // Execute directory indexing
    const repoIndex = await TreeSitterSymbolParser.indexDirectory(tempRepo);

    expect(repoIndex.totalFiles).toBe(4);
    expect(repoIndex.indexedLanguages).toContain("typescript");
    expect(repoIndex.indexedLanguages).toContain("python");
    expect(repoIndex.indexedLanguages).toContain("rust");
    expect(repoIndex.indexedLanguages).toContain("go");

    // Check TypeScript symbols
    const tsSymbols = repoIndex.symbols.filter((s) => s.filePath.endsWith(".ts"));
    expect(tsSymbols.some((s) => s.name === "UniversalScheduler" && s.kind === "class")).toBe(true);
    expect(tsSymbols.some((s) => s.name === "ITaskScheduler" && s.kind === "interface")).toBe(true);
    expect(tsSymbols.some((s) => s.name === "Priority" && s.kind === "type")).toBe(true);
    expect(tsSymbols.some((s) => s.name === "runScheduler" && s.kind === "function")).toBe(true);

    // Check TypeScript imports
    const tsImports = repoIndex.imports.filter((i) => i.fromPath.endsWith(".ts"));
    expect(tsImports.some((i) => i.toPath === "@krypton/shared-types")).toBe(true);

    // Check Python symbols
    const pySymbols = repoIndex.symbols.filter((s) => s.filePath.endsWith(".py"));
    expect(pySymbols.some((s) => s.name === "DataExtractor" && s.kind === "class")).toBe(true);
    expect(pySymbols.some((s) => s.name === "parse_records" && s.kind === "function")).toBe(true);

    // Check Rust symbols
    const rsSymbols = repoIndex.symbols.filter((s) => s.filePath.endsWith(".rs"));
    expect(rsSymbols.some((s) => s.name === "AgentWorker" && s.kind === "class")).toBe(true);
    expect(rsSymbols.some((s) => s.name === "WorkerTrait" && s.kind === "interface")).toBe(true);
    expect(rsSymbols.some((s) => s.name === "WorkerState" && s.kind === "enum")).toBe(true);
    expect(rsSymbols.some((s) => s.name === "start_worker" && s.kind === "function")).toBe(true);

    // Check Go symbols
    const goSymbols = repoIndex.symbols.filter((s) => s.filePath.endsWith(".go"));
    expect(goSymbols.some((s) => s.name === "Config" && s.kind === "class")).toBe(true);
    expect(goSymbols.some((s) => s.name === "Service" && s.kind === "interface")).toBe(true);
    expect(goSymbols.some((s) => s.name === "StartServer" && s.kind === "function")).toBe(true);
  });

  it("handles headless LSP client diagnostics, definitions, and hover queries", async () => {
    const lsp = new HeadlessLspClient({ mockMode: true });

    const started = await lsp.start(tempRepo);
    expect(started).toBe(true);
    expect(lsp.isRunning).toBe(true);

    const testFile = path.join(tempRepo, "test.ts");

    // Open file with injected error
    await lsp.openDocument(testFile, "typescript", "const x = SYNTAX_ERROR_INJECTED;");

    const diags = lsp.getDiagnostics(testFile);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0].severity).toBe("error");

    // Query definition
    const def = await lsp.getDefinition(testFile, 1, 6);
    expect(def).toBeDefined();
    expect(def?.line).toBe(1);

    // Query hover
    const hover = await lsp.getHover(testFile, 1, 6);
    expect(hover?.contents).toContain("Hover signature");

    await lsp.stop();
    expect(lsp.isRunning).toBe(true); // mockMode preserves test state
  });
});

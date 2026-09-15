import * as fs from "node:fs";
import * as path from "node:path";
import { resolveKryptonHome } from "../filesystem/bootstrap.js";

export interface OffloadOptions {
  stepId: string;
  customRoot?: string;
  maxByteThreshold?: number; // default ~6KB (approx 1500 tokens)
  headLines?: number; // default 25
  tailLines?: number; // default 25
}

export interface OffloadResult {
  isOffloaded: boolean;
  content: string;
  offloadDiskPath?: string;
  originalByteLength: number;
  totalLines: number;
}

const DEFAULT_BYTE_THRESHOLD = 6 * 1024; // 6KB
const DEFAULT_HEAD_LINES = 25;
const DEFAULT_TAIL_LINES = 25;

/**
 * Intercepts voluminous tool outputs, offloads full raw logs to disk,
 * and generates head/tail masked summaries for prompt context preservation.
 */
export class ObservationOffloader {
  private readonly outputsDir: string;
  private readonly maxByteThreshold: number;
  private readonly headLines: number;
  private readonly tailLines: number;

  constructor(options?: {
    customRoot?: string;
    maxByteThreshold?: number;
    headLines?: number;
    tailLines?: number;
  }) {
    const home = resolveKryptonHome(options?.customRoot);
    this.outputsDir = path.join(home, "cache", "outputs");
    if (!fs.existsSync(this.outputsDir)) {
      fs.mkdirSync(this.outputsDir, { recursive: true });
    }

    this.maxByteThreshold = options?.maxByteThreshold ?? DEFAULT_BYTE_THRESHOLD;
    this.headLines = options?.headLines ?? DEFAULT_HEAD_LINES;
    this.tailLines = options?.tailLines ?? DEFAULT_TAIL_LINES;
  }

  public offloadIfNeeded(rawOutput: string, stepId: string): OffloadResult {
    const byteLength = Buffer.byteLength(rawOutput, "utf-8");
    const lines = rawOutput.split("\n");
    const totalLines = lines.length;

    if (byteLength <= this.maxByteThreshold) {
      return {
        isOffloaded: false,
        content: rawOutput,
        originalByteLength: byteLength,
        totalLines,
      };
    }

    // Persist to disk
    const safeStepId = stepId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const logFilePath = path.join(this.outputsDir, `run_step_${safeStepId}.log`);
    fs.writeFileSync(logFilePath, rawOutput, "utf-8");

    // Extract head and tail
    const head = lines.slice(0, this.headLines);
    const tail = lines.slice(-this.tailLines);
    const omittedCount = Math.max(0, totalLines - (this.headLines + this.tailLines));

    const maskedSummary = [
      `[OUTPUT OFFLOADED TO DISK: ${logFilePath}]`,
      `Total Lines: ${totalLines} | Total Size: ${byteLength} bytes`,
      `--- BEGIN HEAD (First ${head.length} lines) ---`,
      ...head,
      `--- TRUNCATED (${omittedCount} lines omitted) ---`,
      `--- BEGIN TAIL (Last ${tail.length} lines) ---`,
      ...tail,
      `[END OF MASKED SUMMARY]`,
    ].join("\n");

    return {
      isOffloaded: true,
      content: maskedSummary,
      offloadDiskPath: logFilePath,
      originalByteLength: byteLength,
      totalLines,
    };
  }
}

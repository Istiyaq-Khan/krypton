import { z } from "zod";
import { BoundingBox, BoundingBoxSchema } from "./browser.js";

/**
 * Native desktop application window metadata.
 */
export const DesktopWindowInfoSchema = z.object({
  id: z.string(),
  title: z.string(),
  processName: z.string().default(""),
  processId: z.number().int().nonnegative().default(0),
  bounds: BoundingBoxSchema.default({ x: 0, y: 0, width: 0, height: 0 }),
  isMinimized: z.boolean().default(false),
  isFocused: z.boolean().default(false),
  handle: z.string().optional(),
});
export type DesktopWindowInfo = z.infer<typeof DesktopWindowInfoSchema>;

/**
 * Native desktop OS accessibility tree UI control node (Windows UIA / macOS AXUIElement).
 */
export interface DesktopUINode {
  id: string;
  name: string;
  role: string;
  bounds: BoundingBox;
  className: string;
  isEnabled: boolean;
  handle?: string;
  children: DesktopUINode[];
}

export const DesktopUINodeSchema: z.ZodType<DesktopUINode, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string().default(""),
    role: z.string(),
    bounds: BoundingBoxSchema.default({ x: 0, y: 0, width: 0, height: 0 }),
    className: z.string().default(""),
    isEnabled: z.boolean().default(true),
    handle: z.string().optional(),
    children: z.array(DesktopUINodeSchema).default([]),
  })
);

/**
 * Result returned upon generating a compressed Backup Vault archive.
 */
export const BackupVaultResultSchema = z.object({
  success: z.boolean(),
  archivePath: z.string(),
  archiveName: z.string(),
  fileCount: z.number().int().nonnegative(),
  totalBytesUncompressed: z.number().int().nonnegative(),
  totalBytesCompressed: z.number().int().nonnegative(),
  timestamp: z.number(),
  agentsIncluded: z.array(z.string()).default([]),
});
export type BackupVaultResult = z.infer<typeof BackupVaultResultSchema>;

/**
 * Result returned upon executing a Factory Reset and Complete Data Purge.
 */
export const PurgeDataResultSchema = z.object({
  success: z.boolean(),
  daemonsTerminated: z.boolean(),
  purgedDirectories: z.array(z.string()),
  failedDirectories: z.array(z.string()).default([]),
  timestamp: z.number(),
  message: z.string(),
});
export type PurgeDataResult = z.infer<typeof PurgeDataResultSchema>;

/**
 * Result returned upon triggering the platform-specific uninstallation flow.
 */
export const UninstallResultSchema = z.object({
  success: z.boolean(),
  platform: z.enum(["windows", "macos", "linux", "unknown"]),
  actionTaken: z.string(),
  dataPurged: z.boolean(),
  uninstallerExecuted: z.boolean().default(false),
  manualInstructions: z.string().optional(),
});
export type UninstallResult = z.infer<typeof UninstallResultSchema>;

/**
 * System storage, cache, and runtime directories for UI inspection.
 */
export const StoragePathsInfoSchema = z.object({
  kryptonHome: z.string(),
  appData: z.string(),
  localAppData: z.string().optional(),
  cacheDir: z.string(),
  logsDir: z.string(),
  agentsDir: z.string(),
  worktreesDir: z.string(),
  osPlatform: z.string(),
});
export type StoragePathsInfo = z.infer<typeof StoragePathsInfoSchema>;


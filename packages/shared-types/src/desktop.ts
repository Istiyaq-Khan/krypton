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

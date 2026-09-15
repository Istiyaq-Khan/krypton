import { describe, it, expect } from "vitest";
import { NativeAccessibilityReader } from "../src/desktop-os/native-tree.js";
import { NativeWindowManager } from "../src/desktop-os/window-manager.js";

describe("Phase 4 Verification Gate: Native Desktop OS Automation", () => {
  it("reads native desktop controls and queries UI elements", async () => {
    const reader = new NativeAccessibilityReader({
      mockElements: [
        {
          id: "win_1",
          name: "Visual Studio Code",
          role: "window",
          bounds: { x: 0, y: 0, width: 1920, height: 1080 },
          className: "Code",
          isEnabled: true,
          children: [
            {
              id: "btn_save",
              name: "Save",
              role: "button",
              bounds: { x: 50, y: 20, width: 60, height: 25 },
              className: "Button",
              isEnabled: true,
              children: [],
            },
          ],
        },
        {
          id: "win_2",
          name: "Terminal",
          role: "window",
          bounds: { x: 100, y: 100, width: 800, height: 600 },
          className: "ConsoleWindowClass",
          isEnabled: true,
          children: [],
        },
      ],
    });

    const tree = await reader.readNativeTree();
    expect(tree).toHaveLength(2);
    expect(tree[0].name).toBe("Visual Studio Code");

    // Search for control
    const saveBtn = await reader.findControl("save");
    expect(saveBtn).toBeDefined();
    expect(saveBtn?.id).toBe("btn_save");
    expect(saveBtn?.role).toBe("button");

    const terminalWin = await reader.findControl("terminal");
    expect(terminalWin).toBeDefined();
    expect(terminalWin?.id).toBe("win_2");
  });

  it("manages native application windows (listing, focusing, minimizing, positioning)", async () => {
    const manager = new NativeWindowManager({
      mockWindows: [
        {
          id: "win_101",
          title: "Krypton Dashboard",
          processName: "krypton",
          processId: 1010,
          bounds: { x: 100, y: 100, width: 1200, height: 800 },
          isMinimized: false,
          isFocused: false,
        },
        {
          id: "win_102",
          title: "Google Chrome",
          processName: "chrome",
          processId: 2020,
          bounds: { x: 200, y: 200, width: 1024, height: 768 },
          isMinimized: false,
          isFocused: true,
        },
      ],
    });

    const openWindows = await manager.getOpenWindows();
    expect(openWindows).toHaveLength(2);

    // Focus window
    const focused = await manager.focusWindow("Krypton Dashboard");
    expect(focused).toBe(true);

    const afterFocus = await manager.getOpenWindows();
    const kryptonWin = afterFocus.find((w) => w.id === "win_101");
    expect(kryptonWin?.isFocused).toBe(true);

    // Minimize window
    const minimized = await manager.minimizeWindow("Krypton Dashboard");
    expect(minimized).toBe(true);

    const afterMinimize = await manager.getOpenWindows();
    const kryptonMin = afterMinimize.find((w) => w.id === "win_101");
    expect(kryptonMin?.isMinimized).toBe(true);
    expect(kryptonMin?.isFocused).toBe(false);

    // Position window
    const moved = await manager.setWindowBounds("Krypton Dashboard", {
      x: 300,
      y: 150,
      width: 1400,
      height: 900,
    });
    expect(moved).toBe(true);

    const afterMove = await manager.getOpenWindows();
    const kryptonMoved = afterMove.find((w) => w.id === "win_101");
    expect(kryptonMoved?.bounds.x).toBe(300);
    expect(kryptonMoved?.bounds.y).toBe(150);
    expect(kryptonMoved?.bounds.width).toBe(1400);
    expect(kryptonMoved?.bounds.height).toBe(900);
  });
});

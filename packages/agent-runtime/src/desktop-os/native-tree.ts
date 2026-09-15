import * as child_process from "node:child_process";
import { DesktopUINode } from "@krypton/shared-types";

export interface NativeReaderOptions {
  mockElements?: DesktopUINode[];
  timeoutMs?: number;
}

/**
 * Reads the native operating system accessibility tree (Windows UIA / macOS AXUIElement).
 */
export class NativeAccessibilityReader {
  private readonly mockElements?: DesktopUINode[];
  private readonly timeoutMs: number;

  constructor(options: NativeReaderOptions = {}) {
    this.mockElements = options.mockElements;
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  /**
   * Reads native desktop UI controls and returns a hierarchical or flat array of DesktopUINodes.
   */
  public async readNativeTree(): Promise<DesktopUINode[]> {
    if (this.mockElements) {
      return this.mockElements;
    }

    if (process.platform === "win32") {
      return await this.readWindowsUiaTree();
    } else if (process.platform === "darwin") {
      return await this.readMacOsAxTree();
    } else {
      return await this.readLinuxDesktopTree();
    }
  }

  /**
   * Searches for a desktop UI control by name or role.
   */
  public async findControl(nameOrRole: string): Promise<DesktopUINode | null> {
    const nodes = await this.readNativeTree();
    const query = nameOrRole.toLowerCase();

    const searchNode = (node: DesktopUINode): DesktopUINode | null => {
      if (
        node.name.toLowerCase().includes(query) ||
        node.role.toLowerCase().includes(query)
      ) {
        return node;
      }
      for (const child of node.children || []) {
        const found = searchNode(child);
        if (found) return found;
      }
      return null;
    };

    for (const root of nodes) {
      const match = searchNode(root);
      if (match) return match;
    }

    return null;
  }

  private async readWindowsUiaTree(): Promise<DesktopUINode[]> {
    const script = `
      try {
        Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes -ErrorAction Stop
        $root = [System.Windows.Automation.AutomationElement]::RootElement
        $cond = [System.Windows.Automation.Condition]::TrueCondition
        $elems = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $cond)
        $out = @()
        foreach ($el in $elems) {
          try {
            $rect = $el.Current.BoundingRectangle
            $out += @{
              id = $el.Current.AutomationId
              name = $el.Current.Name
              role = $el.Current.ControlType.ProgrammaticName.Replace("ControlType.", "")
              className = $el.Current.ClassName
              isEnabled = $el.Current.IsEnabled
              x = [int]$rect.X
              y = [int]$rect.Y
              w = [int]$rect.Width
              h = [int]$rect.Height
            }
          } catch {}
        }
        $out | ConvertTo-Json -Compress
      } catch {
        # Fallback to Get-Process with MainWindowHandle
        Get-Process | Where-Object { $_.MainWindowTitle } | ForEach-Object {
          @{
            id = "win_" + $_.Id
            name = $_.MainWindowTitle
            role = "Window"
            className = $_.ProcessName
            isEnabled = $true
            x = 0
            y = 0
            w = 1920
            h = 1080
          }
        } | ConvertTo-Json -Compress
      }
    `;

    try {
      const stdout = await this.execPowerShell(script);
      if (!stdout || !stdout.trim()) return [];

      const parsed = JSON.parse(stdout.trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];

      return items.map((item: any) => ({
        id: String(item.id || `node_${item.name || Math.random()}`),
        name: String(item.name || ""),
        role: String(item.role || "window").toLowerCase(),
        bounds: {
          x: Number(item.x) || 0,
          y: Number(item.y) || 0,
          width: Math.max(0, Number(item.w) || 100),
          height: Math.max(0, Number(item.h) || 30),
        },
        className: String(item.className || ""),
        isEnabled: item.isEnabled !== false,
        children: [],
      }));
    } catch {
      return [];
    }
  }

  private async readMacOsAxTree(): Promise<DesktopUINode[]> {
    const script = `
      tell application "System Events"
        set appList to every application process whose visible is true
        set res to ""
        repeat with p in appList
          try
            set pName to name of p
            set pWindows to every window of p
            repeat with w in pWindows
              set wName to name of w
              set res to res & pName & "|" & wName & "\\n"
            end repeat
          end try
        end repeat
        return res
      end tell
    `;

    return new Promise((resolve) => {
      child_process.exec(
        `osascript -e '${script.replace(/'/g, "'\\''")}'`,
        { timeout: this.timeoutMs },
        (err, stdout) => {
          if (err || !stdout) {
            return resolve([]);
          }

          const lines = stdout.trim().split("\n").filter(Boolean);
          const nodes: DesktopUINode[] = lines.map((line, idx) => {
            const [pName, wName] = line.split("|");
            return {
              id: `mac_node_${idx}`,
              name: wName || pName || "Window",
              role: "window",
              bounds: { x: 0, y: 0, width: 1440, height: 900 },
              className: pName || "",
              isEnabled: true,
              children: [],
            };
          });

          resolve(nodes);
        }
      );
    });
  }

  private async readLinuxDesktopTree(): Promise<DesktopUINode[]> {
    return new Promise((resolve) => {
      child_process.exec(
        `wmctrl -l`,
        { timeout: this.timeoutMs },
        (err, stdout) => {
          if (err || !stdout) {
            return resolve([]);
          }

          const lines = stdout.trim().split("\n").filter(Boolean);
          const nodes: DesktopUINode[] = lines.map((line, idx) => {
            const parts = line.split(/\s+/);
            const title = parts.slice(3).join(" ");
            return {
              id: parts[0] || `lin_node_${idx}`,
              name: title || "Window",
              role: "window",
              bounds: { x: 0, y: 0, width: 1920, height: 1080 },
              className: parts[1] || "",
              isEnabled: true,
              children: [],
            };
          });

          resolve(nodes);
        }
      );
    });
  }

  private execPowerShell(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      child_process.exec(
        `powershell -NoProfile -NonInteractive -Command "${command.replace(/"/g, '\\"')}"`,
        { timeout: this.timeoutMs },
        (err, stdout) => {
          if (err) resolve("");
          else resolve(stdout);
        }
      );
    });
  }
}

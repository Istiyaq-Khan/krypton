import * as child_process from "node:child_process";
import { BoundingBox, DesktopWindowInfo } from "@krypton/shared-types";

export interface WindowManagerOptions {
  mockWindows?: DesktopWindowInfo[];
  timeoutMs?: number;
}

/**
 * Cross-platform native application window manager.
 * Lists open windows, focuses, minimizes, and sets window dimensions.
 */
export class NativeWindowManager {
  private mockWindows: DesktopWindowInfo[] | null = null;
  private readonly timeoutMs: number;

  constructor(options: WindowManagerOptions = {}) {
    if (options.mockWindows) {
      this.mockWindows = options.mockWindows.map((w) => ({ ...w }));
    }
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  /**
   * Lists all open application windows currently active on the desktop.
   */
  public async getOpenWindows(): Promise<DesktopWindowInfo[]> {
    if (this.mockWindows) {
      return this.mockWindows.map((w) => ({ ...w }));
    }

    if (process.platform === "win32") {
      return await this.getWindowsWindows();
    } else if (process.platform === "darwin") {
      return await this.getMacWindows();
    } else {
      return await this.getLinuxWindows();
    }
  }

  /**
   * Brings a target window to the foreground and focuses it.
   */
  public async focusWindow(titleOrId: string): Promise<boolean> {
    if (this.mockWindows) {
      const match = this.mockWindows.find(
        (w) => w.id === titleOrId || w.title.toLowerCase().includes(titleOrId.toLowerCase())
      );
      if (match) {
        this.mockWindows.forEach((w) => (w.isFocused = false));
        match.isFocused = true;
        match.isMinimized = false;
        return true;
      }
      return false;
    }

    if (process.platform === "win32") {
      const psScript = `
        $wshell = New-Object -ComObject Wscript.Shell
        $res = $wshell.AppActivate("${titleOrId.replace(/"/g, '`"')}")
        $res
      `;
      const out = await this.execPowerShell(psScript);
      return out.trim().toLowerCase() === "true";
    } else if (process.platform === "darwin") {
      return new Promise((resolve) => {
        child_process.exec(
          `osascript -e 'tell application "${titleOrId}" to activate'`,
          { timeout: this.timeoutMs },
          (err) => resolve(!err)
        );
      });
    } else {
      return new Promise((resolve) => {
        child_process.exec(
          `wmctrl -a "${titleOrId}"`,
          { timeout: this.timeoutMs },
          (err) => resolve(!err)
        );
      });
    }
  }

  /**
   * Minimizes a target window.
   */
  public async minimizeWindow(titleOrId: string): Promise<boolean> {
    if (this.mockWindows) {
      const match = this.mockWindows.find(
        (w) => w.id === titleOrId || w.title.toLowerCase().includes(titleOrId.toLowerCase())
      );
      if (match) {
        match.isMinimized = true;
        match.isFocused = false;
        return true;
      }
      return false;
    }

    if (process.platform === "win32") {
      const psScript = `
        $sig = '[DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);'
        Add-Type -MemberDefinition $sig -Name Win32ShowWindowAsync -Namespace Win32Utils -ErrorAction SilentlyContinue
        $p = Get-Process | Where-Object { $_.MainWindowTitle -like "*${titleOrId}*" } | Select-Object -First 1
        if ($p -and $p.MainWindowHandle) {
          [Win32Utils.Win32ShowWindowAsync]::ShowWindowAsync($p.MainWindowHandle, 2)
        } else { $false }
      `;
      const out = await this.execPowerShell(psScript);
      return out.trim().toLowerCase() === "true";
    }

    return true;
  }

  /**
   * Sets window position and bounds.
   */
  public async setWindowBounds(titleOrId: string, bounds: BoundingBox): Promise<boolean> {
    if (this.mockWindows) {
      const match = this.mockWindows.find(
        (w) => w.id === titleOrId || w.title.toLowerCase().includes(titleOrId.toLowerCase())
      );
      if (match) {
        match.bounds = { ...bounds };
        return true;
      }
      return false;
    }

    if (process.platform === "win32") {
      const psScript = `
        $sig = '[DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);'
        Add-Type -MemberDefinition $sig -Name Win32MoveWindow -Namespace Win32Utils -ErrorAction SilentlyContinue
        $p = Get-Process | Where-Object { $_.MainWindowTitle -like "*${titleOrId}*" } | Select-Object -First 1
        if ($p -and $p.MainWindowHandle) {
          [Win32Utils.Win32MoveWindow]::MoveWindow($p.MainWindowHandle, ${bounds.x}, ${bounds.y}, ${bounds.width}, ${bounds.height}, $true)
        } else { $false }
      `;
      const out = await this.execPowerShell(psScript);
      return out.trim().toLowerCase() === "true";
    }

    return true;
  }

  private async getWindowsWindows(): Promise<DesktopWindowInfo[]> {
    const psScript = `
      Get-Process | Where-Object { $_.MainWindowTitle } | ForEach-Object {
        @{
          id = "win_" + $_.Id
          title = $_.MainWindowTitle
          processName = $_.ProcessName
          processId = $_.Id
          bounds = @{ x = 0; y = 0; width = 1920; height = 1080 }
          isMinimized = $false
          isFocused = $false
        }
      } | ConvertTo-Json -Compress
    `;

    try {
      const out = await this.execPowerShell(psScript);
      if (!out || !out.trim()) return [];

      const parsed = JSON.parse(out.trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];

      return items.map((item: any) => ({
        id: String(item.id),
        title: String(item.title || ""),
        processName: String(item.processName || ""),
        processId: Number(item.processId) || 0,
        bounds: item.bounds || { x: 0, y: 0, width: 1920, height: 1080 },
        isMinimized: Boolean(item.isMinimized),
        isFocused: Boolean(item.isFocused),
      }));
    } catch {
      return [];
    }
  }

  private async getMacWindows(): Promise<DesktopWindowInfo[]> {
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
          if (err || !stdout) return resolve([]);
          const lines = stdout.trim().split("\n").filter(Boolean);
          const windows: DesktopWindowInfo[] = lines.map((l, i) => {
            const [processName, title] = l.split("|");
            return {
              id: `mac_win_${i}`,
              title: title || processName || "Window",
              processName: processName || "",
              processId: 0,
              bounds: { x: 0, y: 0, width: 1440, height: 900 },
              isMinimized: false,
              isFocused: false,
            };
          });
          resolve(windows);
        }
      );
    });
  }

  private async getLinuxWindows(): Promise<DesktopWindowInfo[]> {
    return new Promise((resolve) => {
      child_process.exec(`wmctrl -l -p`, { timeout: this.timeoutMs }, (err, stdout) => {
        if (err || !stdout) return resolve([]);
        const lines = stdout.trim().split("\n").filter(Boolean);
        const windows: DesktopWindowInfo[] = lines.map((l) => {
          const parts = l.split(/\s+/);
          const id = parts[0];
          const pid = parseInt(parts[2], 10) || 0;
          const title = parts.slice(4).join(" ");
          return {
            id,
            title,
            processName: parts[3] || "",
            processId: pid,
            bounds: { x: 0, y: 0, width: 1920, height: 1080 },
            isMinimized: false,
            isFocused: false,
          };
        });
        resolve(windows);
      });
    });
  }

  private execPowerShell(command: string): Promise<string> {
    return new Promise((resolve) => {
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

import {
  AXNode,
  AXTreeSnapshot,
  BrowserActionRequest,
  BrowserActionResult,
} from "@krypton/shared-types";
import { MouseHumanizer, KeystrokeHumanizer, Point } from "./humanizer.js";

/**
 * Protocol interface for driving page events (CDP or DOM dispatcher).
 */
export interface IBrowserPageDispatcher {
  evaluate<T>(script: string, ...args: unknown[]): Promise<T>;
  dispatchMouseEvent(event: {
    type: "mousePressed" | "mouseReleased" | "mouseMoved" | "mouseWheel";
    x: number;
    y: number;
    button?: "left" | "right" | "middle";
    deltaX?: number;
    deltaY?: number;
  }): Promise<void>;
  dispatchKeyEvent(event: {
    type: "keyDown" | "keyUp" | "char";
    text?: string;
    key?: string;
  }): Promise<void>;
}

/**
 * Default mock page dispatcher used for headless operations or test environments.
 */
export class MockPageDispatcher implements IBrowserPageDispatcher {
  public evaluatedScripts: string[] = [];
  public mouseEvents: Array<{ type: string; x: number; y: number }> = [];
  public keyEvents: Array<{ type: string; text?: string }> = [];

  public async evaluate<T>(script: string): Promise<T> {
    this.evaluatedScripts.push(script);
    return undefined as unknown as T;
  }

  public async dispatchMouseEvent(event: {
    type: "mousePressed" | "mouseReleased" | "mouseMoved" | "mouseWheel";
    x: number;
    y: number;
  }): Promise<void> {
    this.mouseEvents.push(event);
  }

  public async dispatchKeyEvent(event: {
    type: "keyDown" | "keyUp" | "char";
    text?: string;
  }): Promise<void> {
    this.keyEvents.push(event);
  }
}

/**
 * Executes high-level blind navigation actions with humanized motor paths
 * and an injected visual cursor overlay.
 */
export class BrowserActions {
  private currentMouse: Point = { x: 0, y: 0 };
  private activeSnapshot: AXTreeSnapshot | null = null;
  private readonly dispatcher: IBrowserPageDispatcher;
  private cursorInjected = false;
  private activeAgentName: string;

  constructor(
    dispatcher?: IBrowserPageDispatcher,
    agentName = "KryptonBot"
  ) {
    this.dispatcher = dispatcher || new MockPageDispatcher();
    this.activeAgentName = agentName;
  }

  public setSnapshot(snapshot: AXTreeSnapshot): void {
    this.activeSnapshot = snapshot;
  }

  public setAgentName(name: string): void {
    this.activeAgentName = name;
  }

  public getCurrentMousePosition(): Point {
    return { ...this.currentMouse };
  }

  /**
   * Injects a visible, non-interfering agent cursor overlay with a name badge into the DOM.
   */
  public async ensureVisualCursor(agentName?: string): Promise<void> {
    const name = agentName || this.activeAgentName;
    const script = BrowserActions.getCursorInjectionScript(name);
    await this.dispatcher.evaluate(script);
    this.cursorInjected = true;
  }

  /**
   * Executes a high-level blind navigation action request.
   */
  public async executeAction(
    request: BrowserActionRequest
  ): Promise<BrowserActionResult> {
    const startTime = Date.now();

    try {
      if (request.agentName && request.agentName !== this.activeAgentName) {
        this.activeAgentName = request.agentName;
        await this.ensureVisualCursor(request.agentName);
      } else if (!this.cursorInjected) {
        await this.ensureVisualCursor(this.activeAgentName);
      }

      switch (request.action) {
        case "click":
          return await this.click(request.targetId, request.coordinates, request.selector);
        case "type":
          return await this.type(request.targetId, request.text || "", request.coordinates);
        case "select":
          return await this.select(request.targetId, request.value || "");
        case "scroll":
          return await this.scroll(request.direction || "down", request.amount || 300);
        case "hover":
          return await this.hover(request.targetId, request.coordinates);
        default:
          throw new Error(`Unsupported browser action: ${(request as { action: string }).action}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        action: request.action,
        targetId: request.targetId,
        coordinates: request.coordinates,
        error: errorMsg,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Clicks an element identified by transient numeric AXTree ID, coordinates, or selector fallback.
   */
  public async click(
    targetId?: number,
    coordinates?: Point,
    selector?: string
  ): Promise<BrowserActionResult> {
    const start = Date.now();
    const targetPoint = this.resolveTargetPoint(targetId, coordinates, selector);

    // Humanized mouse trajectory to element
    await this.moveMouseHumanized(targetPoint);

    // Mouse press & release (click)
    await this.dispatcher.dispatchMouseEvent({
      type: "mousePressed",
      button: "left",
      x: targetPoint.x,
      y: targetPoint.y,
    });

    // Natural 30ms-70ms click duration
    await this.sleep(45);

    await this.dispatcher.dispatchMouseEvent({
      type: "mouseReleased",
      button: "left",
      x: targetPoint.x,
      y: targetPoint.y,
    });

    return {
      success: true,
      action: "click",
      targetId,
      coordinates: targetPoint,
      durationMs: Date.now() - start,
    };
  }

  /**
   * Types text into a target input element with Gaussian-distributed keypress intervals.
   */
  public async type(
    targetId?: number,
    text = "",
    coordinates?: Point
  ): Promise<BrowserActionResult> {
    const start = Date.now();

    // Click to focus element first
    const targetPoint = this.resolveTargetPoint(targetId, coordinates);
    await this.click(targetId, targetPoint);

    const delays = KeystrokeHumanizer.generateDelays(text);

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const delay = delays[i];

      await this.dispatcher.dispatchKeyEvent({ type: "keyDown", text: char, key: char });
      await this.dispatcher.dispatchKeyEvent({ type: "char", text: char });
      await this.dispatcher.dispatchKeyEvent({ type: "keyUp", text: char, key: char });

      // Artificial human typing pause
      if (delay > 0) {
        await this.sleep(Math.min(delay, 200)); // Cap during automated headless execution
      }
    }

    return {
      success: true,
      action: "type",
      targetId,
      coordinates: targetPoint,
      durationMs: Date.now() - start,
    };
  }

  /**
   * Selects an option value in a dropdown or combobox.
   */
  public async select(
    targetId?: number,
    value = ""
  ): Promise<BrowserActionResult> {
    const start = Date.now();
    const targetPoint = this.resolveTargetPoint(targetId);

    await this.click(targetId, targetPoint);

    // Trigger value assignment via evaluate fallback
    await this.dispatcher.evaluate(
      `(() => {
        const el = document.querySelector('[data-krypton-id="${targetId}"]') || document.activeElement;
        if (el && 'value' in el) {
          el.value = ${JSON.stringify(value)};
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()`
    );

    return {
      success: true,
      action: "select",
      targetId,
      coordinates: targetPoint,
      durationMs: Date.now() - start,
    };
  }

  /**
   * Scrolls the viewport or active container.
   */
  public async scroll(
    direction: "up" | "down" | "left" | "right" = "down",
    amount = 300
  ): Promise<BrowserActionResult> {
    const start = Date.now();
    const deltaY = direction === "down" ? amount : direction === "up" ? -amount : 0;
    const deltaX = direction === "right" ? amount : direction === "left" ? -amount : 0;

    await this.dispatcher.dispatchMouseEvent({
      type: "mouseWheel",
      x: this.currentMouse.x,
      y: this.currentMouse.y,
      deltaX,
      deltaY,
    });

    return {
      success: true,
      action: "scroll",
      coordinates: this.currentMouse,
      durationMs: Date.now() - start,
    };
  }

  /**
   * Hovers over target element without clicking.
   */
  public async hover(
    targetId?: number,
    coordinates?: Point
  ): Promise<BrowserActionResult> {
    const start = Date.now();
    const targetPoint = this.resolveTargetPoint(targetId, coordinates);

    await this.moveMouseHumanized(targetPoint);

    return {
      success: true,
      action: "hover",
      targetId,
      coordinates: targetPoint,
      durationMs: Date.now() - start,
    };
  }

  /**
   * Smoothly moves mouse to target point following cubic Bézier trajectories.
   */
  private async moveMouseHumanized(target: Point): Promise<void> {
    const trajectory = MouseHumanizer.generateTrajectory(this.currentMouse, target);

    for (const pt of trajectory) {
      this.currentMouse = pt;
      await this.dispatcher.dispatchMouseEvent({
        type: "mouseMoved",
        x: pt.x,
        y: pt.y,
      });

      // Update in-DOM visual cursor coordinates
      await this.updateCursorPosition(pt.x, pt.y);
    }

    this.currentMouse = target;
  }

  private async updateCursorPosition(x: number, y: number): Promise<void> {
    await this.dispatcher.evaluate(
      `if (window.__kryptonUpdateCursor) window.__kryptonUpdateCursor(${x}, ${y});`
    );
  }

  private resolveTargetPoint(
    targetId?: number,
    explicitPoint?: Point,
    selector?: string
  ): Point {
    if (explicitPoint) {
      return explicitPoint;
    }

    if (targetId && this.activeSnapshot) {
      const node = this.activeSnapshot.interactiveNodes.find((n) => n.id === targetId);
      if (node) {
        return {
          x: Math.round(node.bounds.x + node.bounds.width / 2),
          y: Math.round(node.bounds.y + node.bounds.height / 2),
        };
      }
    }

    // Default fallback coordinate
    return { x: 200, y: 200 };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Injected script that creates the `#krypton-agent-cursor` overlay.
   */
  public static getCursorInjectionScript(agentName: string): string {
    return `
      (() => {
        let cursor = document.getElementById('krypton-agent-cursor');
        if (!cursor) {
          cursor = document.createElement('div');
          cursor.id = 'krypton-agent-cursor';
          cursor.style.position = 'fixed';
          cursor.style.top = '0px';
          cursor.style.left = '0px';
          cursor.style.zIndex = '2147483647';
          cursor.style.pointerEvents = 'none';
          cursor.style.transform = 'translate3d(0px, 0px, 0px)';
          cursor.style.transition = 'transform 0.04s cubic-bezier(0.2, 0, 0, 1)';
          cursor.innerHTML = \`
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));">
              <path d="M3 3L10.5 21L13.5 13.5L21 10.5L3 3Z" fill="#6366f1" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
            <div id="krypton-cursor-badge" style="margin-top: 2px; margin-left: 12px; background: rgba(15, 23, 42, 0.9); color: #f8fafc; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(99, 102, 241, 0.6); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3); white-space: nowrap;">
              [${agentName}]
            </div>
          \`;
          document.documentElement.appendChild(cursor);
        }

        window.__kryptonUpdateCursor = function(x, y) {
          const el = document.getElementById('krypton-agent-cursor');
          if (el) {
            el.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0px)';
          }
        };
      })();
    `;
  }
}

import { AXNode, AXTreeSnapshot, BoundingBox } from "@krypton/shared-types";

/**
 * Raw accessibility node format returned by Chrome DevTools Protocol Accessibility.getFullAXTree.
 */
export interface CDPAXProperty {
  name: string;
  value: { type: string; value: unknown };
}

export interface CDPAXValue {
  type: string;
  value?: unknown;
}

export interface CDPAXNode {
  nodeId: string | number;
  backendDOMNodeId?: number;
  role?: CDPAXValue;
  name?: CDPAXValue;
  description?: CDPAXValue;
  value?: CDPAXValue;
  properties?: CDPAXProperty[];
  childIds?: (string | number)[];
  ignored?: boolean;
  bounds?: BoundingBox;
}

/**
 * Set of ARIA and HTML accessibility roles considered interactive or actionable.
 */
export const ACTIONABLE_ROLES = new Set([
  "button",
  "link",
  "textbox",
  "searchbox",
  "combobox",
  "checkbox",
  "radio",
  "tab",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "slider",
  "spinbutton",
  "switch",
  "option",
  "treeitem",
  "dialog",
]);

/**
 * Roles that are strictly structural or generic containers and should be pruned.
 */
export const STRUCTURAL_ROLES = new Set([
  "none",
  "generic",
  "genericContainer",
  "group",
  "paragraph",
  "contentinfo",
  "banner",
  "complementary",
  "region",
  "InlineTextBox",
  "StaticText",
  "presentation",
  "LineBreak",
  "div",
  "span",
]);

/**
 * Extracts, prunes, and formats accessibility trees from CDP.
 */
export class AXTreeExtractor {
  /**
   * Prunes non-interactive nodes from a CDP AX tree, assigns sequential transient numeric IDs ([id=1]),
   * and returns a lightweight semantic AXTreeSnapshot.
   */
  public static extractFromRawAXNodes(
    rawNodes: CDPAXNode[],
    url = "about:blank",
    title = ""
  ): AXTreeSnapshot {
    const totalRawNodes = rawNodes.length;
    let nextId = 1;
    const interactiveNodes: AXNode[] = [];

    // Map raw nodeId to interactive node or its resolved child
    const rawToInteractiveId = new Map<string | number, number>();

    for (const raw of rawNodes) {
      if (raw.ignored) continue;

      const role = String(raw.role?.value || "").toLowerCase();
      const name = String(raw.name?.value || "").trim();
      const description = raw.description?.value ? String(raw.description.value) : undefined;
      const value = raw.value?.value !== undefined ? String(raw.value.value) : undefined;

      const isActionableRole = ACTIONABLE_ROLES.has(role);
      const hasActionableProperties = this.hasActionableProperties(raw);

      // Node is actionable if it has an actionable role, or is interactive via click/input properties
      const isActionable = isActionableRole || hasActionableProperties;

      // Skip non-actionable structural nodes
      if (!isActionable) {
        // We keep semantic headings only if they have non-empty names
        if (role !== "heading" || !name) {
          continue;
        }
      }

      const assignedId = nextId++;
      rawToInteractiveId.set(raw.nodeId, assignedId);

      const bounds: BoundingBox = raw.bounds || {
        x: 0,
        y: 0,
        width: 100,
        height: 30,
      };

      const disabled = this.getPropertyBoolean(raw, "disabled") || false;
      const focused = this.getPropertyBoolean(raw, "focused") || false;

      interactiveNodes.push({
        id: assignedId,
        backendDOMNodeId: raw.backendDOMNodeId,
        role: role || (isActionable ? "button" : "generic"),
        name,
        value,
        description,
        bounds,
        isActionable,
        disabled,
        focused,
        children: [],
      });
    }

    // Connect children IDs if available
    for (const raw of rawNodes) {
      const parentInteractiveId = rawToInteractiveId.get(raw.nodeId);
      if (parentInteractiveId && raw.childIds) {
        const parentNode = interactiveNodes.find((n) => n.id === parentInteractiveId);
        if (parentNode) {
          for (const childId of raw.childIds) {
            const childInteractiveId = rawToInteractiveId.get(childId);
            if (childInteractiveId && !parentNode.children.includes(childInteractiveId)) {
              parentNode.children.push(childInteractiveId);
            }
          }
        }
      }
    }

    const prunedNodeCount = Math.max(0, totalRawNodes - interactiveNodes.length);
    const reductionPercentage =
      totalRawNodes > 0
        ? Math.round(((totalRawNodes - interactiveNodes.length) / totalRawNodes) * 1000) / 10
        : 0;

    const formattedSnapshot = this.formatSnapshotText(url, title, interactiveNodes);

    return {
      url,
      title,
      timestamp: Date.now(),
      totalRawNodes,
      interactiveNodes,
      prunedNodeCount,
      reductionPercentage,
      formattedSnapshot,
    };
  }

  /**
   * Formats the interactive AXTree into a concise, token-efficient text representation for LLM prompt context.
   */
  public static formatSnapshotText(
    url: string,
    title: string,
    nodes: AXNode[]
  ): string {
    const lines: string[] = [
      `Page: ${title || "Untitled"} (${url})`,
      `Interactive Elements (${nodes.length} items):`,
    ];

    for (const node of nodes) {
      let line = `[id=${node.id}] ${node.role} "${node.name}"`;
      if (node.value !== undefined && node.value !== "") {
        line += ` value="${node.value}"`;
      }
      if (node.description) {
        line += ` (${node.description})`;
      }
      if (node.disabled) {
        line += ` [disabled]`;
      }
      if (node.focused) {
        line += ` [focused]`;
      }
      line += ` (x:${node.bounds.x}, y:${node.bounds.y}, w:${node.bounds.width}, h:${node.bounds.height})`;
      lines.push(line);
    }

    return lines.join("\n");
  }

  private static hasActionableProperties(raw: CDPAXNode): boolean {
    if (!raw.properties) return false;
    for (const prop of raw.properties) {
      if (["focusable", "editable", "clickable"].includes(prop.name) && prop.value?.value === true) {
        return true;
      }
    }
    return false;
  }

  private static getPropertyBoolean(raw: CDPAXNode, name: string): boolean {
    if (!raw.properties) return false;
    const prop = raw.properties.find((p) => p.name === name);
    return prop?.value?.value === true;
  }
}

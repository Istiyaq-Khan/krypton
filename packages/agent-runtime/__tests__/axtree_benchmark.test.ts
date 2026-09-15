import { describe, it, expect } from "vitest";
import {
  AXTreeExtractor,
  CDPAXNode,
} from "../src/browser/axtree.js";
import { BrowserActions, MockPageDispatcher } from "../src/browser/actions.js";

describe("Phase 4 Verification Gate: AXTree Extraction Benchmark & Blind Navigation", () => {
  it("extracts interactive snapshot, labels transient IDs, and achieves >= 90% size reduction", () => {
    // Generate complex mock web page with 600 raw nodes
    // Mostly structural divs, spans, paragraphs, with only a few interactive elements
    const rawNodes: CDPAXNode[] = [];

    // 1. Structural boilerplate nodes (divs, spans, containers, generic text)
    for (let i = 1; i <= 580; i++) {
      rawNodes.push({
        nodeId: i,
        role: { type: "role", value: i % 3 === 0 ? "none" : i % 2 === 0 ? "generic" : "paragraph" },
        name: { type: "name", value: `Structural element ${i}` },
        bounds: { x: 10, y: i * 2, width: 800, height: 20 },
      });
    }

    // 2. Interactive actionable nodes (inputs, buttons, links, dropdowns)
    rawNodes.push({
      nodeId: 601,
      role: { type: "role", value: "textbox" },
      name: { type: "name", value: "Username" },
      value: { type: "value", value: "admin" },
      bounds: { x: 100, y: 150, width: 250, height: 35 },
      properties: [{ name: "focusable", value: { type: "boolean", value: true } }],
    });

    rawNodes.push({
      nodeId: 602,
      role: { type: "role", value: "textbox" },
      name: { type: "name", value: "Password" },
      bounds: { x: 100, y: 200, width: 250, height: 35 },
      properties: [{ name: "focusable", value: { type: "boolean", value: true } }],
    });

    rawNodes.push({
      nodeId: 603,
      role: { type: "role", value: "button" },
      name: { type: "name", value: "Sign In" },
      bounds: { x: 100, y: 260, width: 120, height: 40 },
    });

    rawNodes.push({
      nodeId: 604,
      role: { type: "role", value: "link" },
      name: { type: "name", value: "Forgot Password?" },
      bounds: { x: 240, y: 270, width: 140, height: 20 },
    });

    rawNodes.push({
      nodeId: 605,
      role: { type: "role", value: "combobox" },
      name: { type: "name", value: "Language" },
      value: { type: "value", value: "en-US" },
      bounds: { x: 100, y: 320, width: 180, height: 35 },
    });

    const snapshot = AXTreeExtractor.extractFromRawAXNodes(
      rawNodes,
      "https://krypton.local/login",
      "Krypton Sign In"
    );

    // Assert transient numeric IDs are sequential starting from 1
    expect(snapshot.interactiveNodes).toHaveLength(5);
    expect(snapshot.interactiveNodes.map((n) => n.id)).toEqual([1, 2, 3, 4, 5]);

    // Assert interactive nodes have correct roles and names
    expect(snapshot.interactiveNodes[0].role).toBe("textbox");
    expect(snapshot.interactiveNodes[0].name).toBe("Username");
    expect(snapshot.interactiveNodes[2].role).toBe("button");
    expect(snapshot.interactiveNodes[2].name).toBe("Sign In");

    // Benchmark assertion: reduction percentage must be >= 90%
    // 585 total raw nodes -> 5 interactive nodes = 99.1% reduction
    expect(snapshot.reductionPercentage).toBeGreaterThanOrEqual(90);
    expect(snapshot.prunedNodeCount).toBe(rawNodes.length - 5);

    // Verify snapshot text formatting
    const formatted = snapshot.formattedSnapshot || "";
    expect(formatted).toContain('[id=1] textbox "Username"');
    expect(formatted).toContain('[id=3] button "Sign In"');
    expect(formatted).toContain("(x:100, y:260, w:120, h:40)");
  });

  it("executes high-level blind navigation actions with humanized mouse and cursor overlay injection", async () => {
    const dispatcher = new MockPageDispatcher();
    const actions = new BrowserActions(dispatcher, "ScraperAgent");

    // Setup snapshot
    actions.setSnapshot({
      url: "https://krypton.local/test",
      title: "Test Page",
      timestamp: Date.now(),
      totalRawNodes: 100,
      interactiveNodes: [
        {
          id: 1,
          role: "textbox",
          name: "Search",
          bounds: { x: 200, y: 100, width: 300, height: 40 },
          isActionable: true,
          disabled: false,
          focused: false,
          children: [],
        },
        {
          id: 2,
          role: "button",
          name: "Submit",
          bounds: { x: 520, y: 100, width: 100, height: 40 },
          isActionable: true,
          disabled: false,
          focused: false,
          children: [],
        },
      ],
      prunedNodeCount: 98,
      reductionPercentage: 98,
    });

    // 1. Test visual cursor overlay injection script
    await actions.ensureVisualCursor("DevBot");
    expect(dispatcher.evaluatedScripts.length).toBeGreaterThan(0);
    const injectionScript = dispatcher.evaluatedScripts[0];
    expect(injectionScript).toContain("krypton-agent-cursor");
    expect(injectionScript).toContain("[DevBot]");
    expect(injectionScript).toContain("__kryptonUpdateCursor");

    // 2. Test click(targetId = 2)
    const clickResult = await actions.click(2);
    expect(clickResult.success).toBe(true);
    expect(clickResult.action).toBe("click");
    expect(clickResult.targetId).toBe(2);
    // Target center coordinates: x = 520 + 50 = 570, y = 100 + 20 = 120
    expect(clickResult.coordinates?.x).toBe(570);
    expect(clickResult.coordinates?.y).toBe(120);

    // Mouse dispatcher should have received move and click events
    expect(dispatcher.mouseEvents.some((e) => e.type === "mouseMoved")).toBe(true);
    expect(dispatcher.mouseEvents.some((e) => e.type === "mousePressed")).toBe(true);
    expect(dispatcher.mouseEvents.some((e) => e.type === "mouseReleased")).toBe(true);

    // 3. Test type(targetId = 1, "hello")
    const typeResult = await actions.type(1, "test");
    expect(typeResult.success).toBe(true);
    expect(typeResult.action).toBe("type");
    expect(dispatcher.keyEvents.length).toBeGreaterThanOrEqual(4);

    // 4. Test scroll("down", 250)
    const scrollResult = await actions.scroll("down", 250);
    expect(scrollResult.success).toBe(true);
    expect(dispatcher.mouseEvents.some((e) => e.type === "mouseWheel")).toBe(true);

    // 5. Test hover(targetId = 2)
    const hoverResult = await actions.hover(2);
    expect(hoverResult.success).toBe(true);
    expect(actions.getCurrentMousePosition().x).toBe(570);
    expect(actions.getCurrentMousePosition().y).toBe(120);
  });
});

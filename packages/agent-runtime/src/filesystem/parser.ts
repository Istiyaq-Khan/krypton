/**
 * Lightweight frontmatter and markdown section parser/serializer for agent files.
 */

export interface ParsedMarkdown<T = Record<string, unknown>> {
  frontmatter: T;
  body: string;
  sections: Record<string, string>;
}

/**
 * Parses simple YAML lines into an object.
 */
export function parseSimpleYaml(yamlStr: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yamlStr.split("\n");

  let currentKey = "";
  let isArray = false;
  let arrayValues: unknown[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    // Check array item
    if (line.startsWith("- ")) {
      const valStr = line.slice(2).trim();
      arrayValues.push(coerceValue(valStr));
      continue;
    }

    // If we were parsing an array and now hit a key
    if (isArray && currentKey) {
      result[currentKey] = arrayValues;
      isArray = false;
      arrayValues = [];
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex !== -1) {
      const key = line.slice(0, colonIndex).trim();
      const valStr = line.slice(colonIndex + 1).trim();

      currentKey = key;
      if (valStr === "") {
        // Starts a list or nested object
        isArray = true;
        arrayValues = [];
      } else {
        result[key] = coerceValue(valStr);
      }
    }
  }

  if (isArray && currentKey) {
    result[currentKey] = arrayValues;
  }

  return result;
}

function coerceValue(val: string): unknown {
  if (val === "true") return true;
  if (val === "false") return false;
  if (val === "null") return null;
  if (/^-?\d+$/.test(val)) return parseInt(val, 10);
  if (/^-?\d+\.\d+$/.test(val)) return parseFloat(val);
  // Strip quotes
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    return val.slice(1, -1);
  }
  return val;
}

/**
 * Serializes a simple object to YAML lines.
 */
export function serializeSimpleYaml(obj: Record<string, unknown>): string {
  const lines: string[] = [];

  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined) continue;

    if (Array.isArray(val)) {
      lines.push(`${key}:`);
      for (const item of val) {
        lines.push(`  - ${serializeValue(item)}`);
      }
    } else if (typeof val === "object" && val !== null) {
      lines.push(`${key}:`);
      for (const [subKey, subVal] of Object.entries(val as Record<string, unknown>)) {
        lines.push(`  ${subKey}: ${serializeValue(subVal)}`);
      }
    } else {
      lines.push(`${key}: ${serializeValue(val)}`);
    }
  }

  return lines.join("\n");
}

function serializeValue(val: unknown): string {
  if (typeof val === "string") {
    if (val.includes(":") || val.includes("#") || val.includes("\n") || val === "") {
      return JSON.stringify(val);
    }
    return val;
  }
  return String(val);
}

/**
 * Extracts sections delimited by markdown headings (e.g. ## Section Name).
 */
export function extractMarkdownSections(markdown: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = markdown.split("\n");

  let currentSection = "root";
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      if (currentContent.length > 0) {
        sections[currentSection] = currentContent.join("\n").trim();
        currentContent = [];
      }
      currentSection = headingMatch[1]?.trim() || "unknown";
    } else {
      currentContent.push(line);
    }
  }

  if (currentContent.length > 0) {
    sections[currentSection] = currentContent.join("\n").trim();
  }

  return sections;
}

/**
 * Parses markdown with optional YAML frontmatter.
 */
export function parseMarkdownWithFrontmatter<T = Record<string, unknown>>(
  content: string
): ParsedMarkdown<T> {
  const trimmed = content.trim();

  if (trimmed.startsWith("---")) {
    const secondFence = trimmed.indexOf("---", 3);
    if (secondFence !== -1) {
      const frontmatterStr = trimmed.slice(3, secondFence).trim();
      const body = trimmed.slice(secondFence + 3).trim();
      const frontmatter = parseSimpleYaml(frontmatterStr) as T;
      const sections = extractMarkdownSections(body);

      return {
        frontmatter,
        body,
        sections,
      };
    }
  }

  return {
    frontmatter: {} as T,
    body: content.trim(),
    sections: extractMarkdownSections(content),
  };
}

/**
 * Serializes frontmatter and markdown body into standard format.
 */
export function serializeMarkdownWithFrontmatter<T extends Record<string, unknown>>(
  frontmatter: T,
  body: string
): string {
  const yaml = serializeSimpleYaml(frontmatter);
  return `---\n${yaml}\n---\n\n${body.trim()}\n`;
}

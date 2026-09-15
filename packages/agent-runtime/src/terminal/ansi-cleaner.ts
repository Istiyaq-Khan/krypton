/**
 * Regular expression matching ANSI CSI sequences:
 * Matches \x1b[ ... [A-Za-z]
 */
const CSI_REGEX = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;

/**
 * Regular expression matching ANSI OSC sequences:
 * Matches \x1b] ... (\x07|\x1b\\)
 */
const OSC_REGEX = /\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g;

/**
 * Regular expression matching ANSI ESC Fe and Fs sequences:
 * Matches 2-character escape sequences like \x1bM, \x1b(B, etc.
 */
const ESC_SEQ_REGEX = /\x1b[PX^_][^\x1b]*\x1b\\|\x1b[@-Z\\-_]/g;

/**
 * Regular expression matching stray control characters (BEL, FF, etc.)
 * but preserving backspace (\x08), tab (\t), newline (\n), and carriage return (\r).
 */
const STRAY_CONTROL_REGEX = /[\x00-\x07\x0b\x0c\x0e-\x1a]/g;

/**
 * Strips all ANSI escape sequences (colors, font styles, cursor movements, erase line/display).
 */
export function stripAnsi(text: string): string {
  if (!text) return "";
  return text
    .replace(OSC_REGEX, "")
    .replace(CSI_REGEX, "")
    .replace(ESC_SEQ_REGEX, "")
    .replace(STRAY_CONTROL_REGEX, "");
}

/**
 * Cleans terminal output for LLM observation ingestion:
 * - Strips all ANSI/VT100 escape codes and colors.
 * - Handles terminal backspaces (\b) by erasing the previous character.
 * - Normalizes Windows (\r\n) and classic Mac (\r) line breaks into standard Unix (\n).
 * - Trims excessive blank line runs.
 */
export function cleanTerminalOutput(rawText: string): string {
  if (!rawText) return "";

  // 1. Strip ANSI escape sequences
  let cleaned = stripAnsi(rawText);

  // 2. Resolve backspace characters (\b)
  if (cleaned.includes("\b")) {
    const chars: string[] = [];
    for (const char of cleaned) {
      if (char === "\b") {
        chars.pop();
      } else {
        chars.push(char);
      }
    }
    cleaned = chars.join("");
  }

  // 3. Normalize carriage returns:
  // First convert CRLF to LF
  cleaned = cleaned.replace(/\r\n/g, "\n");
  // Then replace isolated CR (which terminal uses to return cursor to line start) with newline
  cleaned = cleaned.replace(/\r/g, "\n");

  return cleaned;
}

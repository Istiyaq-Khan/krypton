import * as fs from "node:fs";

async function run(): Promise<void> {
  const scriptPath = process.argv[2];
  if (!scriptPath) {
    console.error("No script path provided");
    process.exit(1);
  }

  try {
    const code = fs.readFileSync(scriptPath, "utf-8");
    // Run within an isolated async wrapper
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const fn = new AsyncFunction("require", "process", "console", code);
    await fn(require, process, console);
  } catch (err: any) {
    console.error(err?.stack || String(err));
    process.exit(1);
  }
}

run();

// Shared helpers for Guider's agent hooks (see references/agent-hooks.md).
// Dependency-free. Claude Code and Codex both send the hook payload as JSON on
// stdin, treat exit code 2 + stderr as "block / tell the agent", and add plain
// stdout from SessionStart to the context.

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";

export async function readInput() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

export function projectRoot(input) {
  return process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
}

// Optional `.guider-hooks.json` at the project root.
export function loadConfig(root) {
  const path = join(root, ".guider-hooks.json");
  try {
    return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  } catch {
    return {};
  }
}

// File paths a tool call writes: Claude's Edit/Write/MultiEdit use
// `tool_input.file_path`; Codex's apply_patch carries them inside the patch text.
export function editedPaths(input, root) {
  const toolInput = input.tool_input ?? {};
  const paths = new Set();
  for (const key of ["file_path", "path", "notebook_path"]) {
    if (typeof toolInput[key] === "string") paths.add(toolInput[key]);
  }
  const text = [toolInput.patch, toolInput.input, toolInput.command]
    .flat()
    .filter((value) => typeof value === "string")
    .join("\n");
  for (const match of text.matchAll(/^\*\*\* (?:Add|Update|Move to:?) File: (.+)$/gm)) paths.add(match[1].trim());
  return [...paths].map((path) => {
    const rel = isAbsolute(path) ? relative(root, path) : path;
    return rel.split(sep).join("/");
  });
}

export function shellCommand(input) {
  const command = input.tool_input?.command;
  if (Array.isArray(command)) return command.join(" ");
  return typeof command === "string" ? command : "";
}

// Exit 2 with the reason on stderr: blocks a PreToolUse call, and feeds the
// message back to the agent after a PostToolUse call.
export function tellAgent(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

// Hooks fail open: a bug in a guard must never wedge the agent.
export function failOpen(main) {
  main().catch((error) => {
    process.stderr.write(`guider hook skipped: ${error.message}\n`);
    process.exit(0);
  });
}

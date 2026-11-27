#!/usr/bin/env node
// PostToolUse hook — copied into the project by `/guider init` (references/agent-hooks.md).
// After the agent edits a file:
//   - runs the project's per-file lint command (from .guider-hooks.json) and the
//     docs gate on Markdown — failures go back to the agent to fix now;
//   - refreshes the code graph for the edited files;
//   - warns (without blocking) when the file contains a security sink worth a
//     second look (references/security.md).

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { editedPaths, failOpen, loadConfig, projectRoot, readInput, tellAgent } from "./_lib.mjs";

const SOURCE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|vue|svelte|py)$/;
const SINKS = [
  { re: /\$queryRawUnsafe|\$executeRawUnsafe|\.raw\(\s*`[^`]*\$\{/, why: "raw SQL built from a string — use bind parameters" },
  { re: /\b(query|execute)\(\s*(`[^`]*\$\{|f["']|["'][^"']*["']\s*(\+|%))/, why: "SQL built by interpolation — use bind parameters" },
  { re: /\bexec(Sync)?\(\s*`[^`]*\$\{|shell\s*=\s*True/, why: "shell command with interpolated input — use execFile/spawn with an args array" },
  { re: /\.innerHTML\s*=|dangerouslySetInnerHTML|v-html=|\{@html\s/, why: "raw HTML injection point — escape or sanitize user content" },
  { re: /\bfetch\(\s*(req|request)\.(body|query|params)/, why: "server-side fetch of a request-supplied URL (SSRF) — allowlist hosts" },
  { re: /\b(pickle\.loads?|yaml\.load)\(/, why: "unsafe deserialization — use a safe loader" },
];

// The hook is registered with a 30s timeout; stay well inside it across all files.
const BUDGET_MS = 25000;
const deadline = Date.now() + BUDGET_MS;

// Run a command within the remaining budget. A timeout is "skipped", never a
// failure: a slow linter must not send the agent chasing an error that isn't there.
function run(root, command, { shell = true, args = [], limitMs = 20000 } = {}) {
  const timeout = Math.min(limitMs, deadline - Date.now());
  if (timeout < 500) return { ok: true, skipped: true, output: "" };
  const result = shell
    ? spawnSync(command, { cwd: root, shell: true, encoding: "utf8", timeout })
    : spawnSync(command, args, { cwd: root, encoding: "utf8", timeout });
  if (result.error || result.signal) return { ok: true, skipped: true, output: "" };
  return { ok: result.status === 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim().slice(-2000) };
}

// The text this tool call wrote, so warnings are about the change, not old code.
function writtenText(input) {
  const toolInput = input.tool_input ?? {};
  const parts = [toolInput.content, toolInput.new_string, ...(toolInput.edits ?? []).map((edit) => edit.new_string)];
  const patch = [toolInput.patch, toolInput.input].find((value) => typeof value === "string");
  if (patch) parts.push(patch.split("\n").filter((line) => line.startsWith("+")).join("\n"));
  const text = parts.filter((value) => typeof value === "string").join("\n");
  return text || null;
}

// Quote a path for the platform shell (cmd.exe doesn't understand single quotes).
const quote = (path) =>
  process.platform === "win32" ? `"${path.replace(/"/g, '""')}"` : `'${path.replace(/'/g, "'\\''")}'`;

failOpen(async () => {
  const input = await readInput();
  const root = projectRoot(input);
  const config = loadConfig(root);
  const scriptsDir = config.scriptsDir ?? "scripts";
  const files = editedPaths(input, root).filter((path) => existsSync(join(root, path)));
  if (!files.length) return;

  const failures = [];
  const warnings = [];
  const written = writtenText(input);

  for (const file of files) {
    if (config.lint && SOURCE.test(file)) {
      const limitMs = (config.lintTimeoutSeconds ?? 20) * 1000;
      const result = run(root, config.lint.replaceAll("{file}", quote(file)), { limitMs });
      if (!result.ok) failures.push(`lint failed on ${file}:\n${result.output}`);
    }
    if (file.endsWith(".md") && existsSync(join(root, scriptsDir, "check-docs.mjs"))) {
      const result = run(root, process.execPath, { shell: false, args: [join(scriptsDir, "check-docs.mjs"), file] });
      if (!result.ok) failures.push(`docs gate failed on ${file}:\n${result.output}`);
    }
    if (config.securityWarnings !== false && SOURCE.test(file)) {
      const text = written ?? readFileSync(join(root, file), "utf8");
      for (const sink of SINKS) if (sink.re.test(text)) warnings.push(`${file}: ${sink.why}`);
    }
  }

  const sourceFiles = files.filter((file) => SOURCE.test(file));
  if (sourceFiles.length && existsSync(join(root, scriptsDir, "graph.mjs")) && existsSync(join(root, ".guider", "graph.json"))) {
    run(root, process.execPath, { shell: false, args: [join(scriptsDir, "graph.mjs"), "refresh", ...sourceFiles] });
  }

  const notes = [];
  if (failures.length) notes.push(...failures);
  if (warnings.length) {
    notes.push(
      "Security check (references/security.md) — confirm each is safe or fix it:\n" +
      warnings.map((warning) => `- ${warning}`).join("\n"),
    );
  }
  if (failures.length) tellAgent(notes.join("\n\n"));
  if (warnings.length) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: notes.join("\n\n") },
      }),
    );
  }
});

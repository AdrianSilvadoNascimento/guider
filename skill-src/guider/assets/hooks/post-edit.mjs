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

function run(root, command, timeout = 20000) {
  const result = spawnSync(command, { cwd: root, shell: true, encoding: "utf8", timeout });
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

const quote = (path) => `'${path.replace(/'/g, "'\\''")}'`;

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
      const result = run(root, config.lint.replaceAll("{file}", quote(file)));
      if (!result.ok) failures.push(`lint failed on ${file}:\n${result.output}`);
    }
    if (file.endsWith(".md") && existsSync(join(root, scriptsDir, "check-docs.mjs"))) {
      const result = run(root, `${quote(process.execPath)} ${quote(join(scriptsDir, "check-docs.mjs"))} ${quote(file)}`);
      if (!result.ok) failures.push(`docs gate failed on ${file}:\n${result.output}`);
    }
    if (config.securityWarnings !== false && SOURCE.test(file)) {
      const text = written ?? readFileSync(join(root, file), "utf8");
      for (const sink of SINKS) if (sink.re.test(text)) warnings.push(`${file}: ${sink.why}`);
    }
  }

  const sourceFiles = files.filter((file) => SOURCE.test(file));
  if (sourceFiles.length && existsSync(join(root, scriptsDir, "graph.mjs")) && existsSync(join(root, ".guider", "graph.json"))) {
    run(root, [process.execPath, join(scriptsDir, "graph.mjs"), "refresh", ...sourceFiles].map(quote).join(" "), 10000);
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

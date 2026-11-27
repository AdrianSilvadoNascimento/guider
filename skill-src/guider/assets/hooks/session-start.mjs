#!/usr/bin/env node
// SessionStart hook — copied into the project by `/guider init` (references/agent-hooks.md).
// Prints the project's hard rules and a one-line code-graph summary; the agent
// receives stdout as context, so it starts every session with the rules in view.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { failOpen, loadConfig, projectRoot, readInput } from "./_lib.mjs";

const MAX_CHARS = 3000;

function hardRules(root) {
  const path = join(root, "AGENTS.md");
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const match = text.match(/^## Hard rules[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m);
  const body = match?.[1].trim();
  if (!body) return null;
  return body.length > MAX_CHARS ? `${body.slice(0, MAX_CHARS)}\n… (see AGENTS.md)` : body;
}

function graphSummary(root, scriptsDir) {
  const script = join(root, scriptsDir, "graph.mjs");
  if (!existsSync(script)) return null;
  const result = spawnSync(process.execPath, [script, "summary", "--brief"], {
    cwd: root,
    encoding: "utf8",
    timeout: 5000,
  });
  const line = result.stdout?.trim();
  return result.status === 0 && line && !line.startsWith("No .guider") ? line : null;
}

failOpen(async () => {
  const input = await readInput();
  const root = projectRoot(input);
  const config = loadConfig(root);
  const parts = [];
  const rules = hardRules(root);
  if (rules) parts.push(`Project hard rules (AGENTS.md):\n${rules}`);
  const graph = graphSummary(root, config.scriptsDir ?? "scripts");
  if (graph) parts.push(graph);
  if (parts.length) process.stdout.write(`${parts.join("\n\n")}\n`);
});

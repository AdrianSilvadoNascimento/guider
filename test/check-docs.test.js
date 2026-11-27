import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../skill-src/guider/assets/check-docs.mjs",
);

function project(files) {
  const root = mkdtempSync(join(tmpdir(), "check-docs-"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

function run(root, args = []) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd: root, encoding: "utf8" });
}

test("passes docs within budget", () => {
  const result = run(project({ "AGENTS.md": "# Agents\n\nShort.\n" }));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1 doc\(s\) ok/);
});

test("fails a doc over its line budget", () => {
  const result = run(project({ "AGENTS.md": "line\n".repeat(200) }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /AGENTS\.md: 201 lines \(budget 150\)/);
});

test("fails a domain doc over its character budget", () => {
  const result = run(project({ "docs/PAYMENTS.md": "word ".repeat(9000).replace(/(.{100})/g, "$1\n") }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /docs\/PAYMENTS\.md: \d+ chars \(budget 40000\)/);
});

test("fails a long line, but not inside a fenced code block", () => {
  const long = "x".repeat(130);
  const fenced = run(project({ "APPLICATION.md": "```\n" + long + "\n```\n" }));
  assert.equal(fenced.status, 0, fenced.stderr);
  const prose = run(project({ "APPLICATION.md": long + "\n" }));
  assert.equal(prose.status, 1);
  assert.match(prose.stderr, /APPLICATION\.md:1: 130 chars \(max 120\)/);
});

test("table rows are exempt from the line length", () => {
  const row = "| " + "cell ".repeat(40) + "|";
  const result = run(project({ "APPLICATION.md": row + "\n" }));
  assert.equal(result.status, 0, result.stderr);
});

test("only warns on history phrases and line-number pointers", () => {
  const result = run(project({
    "ARCHITECTURE.md": "Until 2026-03-01 it was manual.\nSee src/lib/pay.ts:42.\n",
  }));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /ARCHITECTURE\.md:1: history in a reference doc/);
  assert.match(result.stderr, /ARCHITECTURE\.md:2: line-number pointer/);
});

test("specs have no budget and the config file overrides defaults", () => {
  const root = project({
    "docs/specs/big.md": "word ".repeat(9000).replace(/(.{100})/g, "$1\n"),
    "BACKLOG.md": "- item\n".repeat(20),
    ".guider-docs.json": JSON.stringify({ budgets: { "BACKLOG.md": { lines: 10 } } }),
  });
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /BACKLOG\.md: 21 lines \(budget 10\)/);
  assert.doesNotMatch(result.stderr, /big\.md/);
});

test("checks only the files passed as arguments", () => {
  const root = project({ "AGENTS.md": "line\n".repeat(200), "PRODUCT.md": "# Product\n" });
  const result = run(root, ["PRODUCT.md"]);
  assert.equal(result.status, 0, result.stderr);
});

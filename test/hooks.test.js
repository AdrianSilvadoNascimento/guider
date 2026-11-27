import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), "../skill-src/guider/assets");

// A project with the hooks (and the graph/docs scripts) installed where init puts them.
function project(files = {}) {
  const root = mkdtempSync(join(tmpdir(), "hooks-"));
  cpSync(join(ASSETS, "hooks"), join(root, "scripts/guider-hooks"), { recursive: true });
  cpSync(join(ASSETS, "graph.mjs"), join(root, "scripts/graph.mjs"));
  cpSync(join(ASSETS, "check-docs.mjs"), join(root, "scripts/check-docs.mjs"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

function hook(root, name, payload) {
  return spawnSync(process.execPath, [join(root, "scripts/guider-hooks", name)], {
    cwd: root,
    input: JSON.stringify({ cwd: root, ...payload }),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: root, PIP_UPLOADED_PRIOR_TO: "" },
  });
}

const AGENTS = `# AGENTS.md — demo

## Hard rules (worth interrupting a change over)

<!-- example comment -->
- Scope every lookup by ID to the caller.

## How we work

- Not a hard rule.
`;

test("session-start prints the hard rules and the graph summary", () => {
  const root = project({ "AGENTS.md": AGENTS, "src/a.js": 'import "./b.js";\n', "src/b.js": "" });
  spawnSync(process.execPath, ["scripts/graph.mjs", "build"], { cwd: root });
  const result = hook(root, "session-start.mjs", { hook_event_name: "SessionStart" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Scope every lookup by ID/);
  assert.doesNotMatch(result.stdout, /Not a hard rule|example comment/);
  assert.match(result.stdout, /Code graph: \d+ files/);
});

test("session-start is silent without AGENTS.md or a graph", () => {
  const result = hook(project(), "session-start.mjs", {});
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
});

test("pre-tool-guard blocks writing secret files but allows .env.example", () => {
  const root = project();
  const blocked = hook(root, "pre-tool-guard.mjs", { tool_name: "Write", tool_input: { file_path: join(root, ".env.local") } });
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /\.env\.local holds secrets/);
  const allowed = hook(root, "pre-tool-guard.mjs", { tool_name: "Write", tool_input: { file_path: ".env.example" } });
  assert.equal(allowed.status, 0);
});

test("pre-tool-guard reads paths from a Codex apply_patch", () => {
  const patch = "*** Begin Patch\n*** Add File: config/server.pem\n+x\n*** End Patch";
  const result = hook(project(), "pre-tool-guard.mjs", { tool_name: "apply_patch", tool_input: { input: patch } });
  assert.equal(result.status, 2);
});

test("pre-tool-guard blocks adding a package without a quarantine, allows it with one", () => {
  const bare = project();
  const blocked = hook(bare, "pre-tool-guard.mjs", { tool_name: "Bash", tool_input: { command: "npm install -D lodash" } });
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /min-release-age=7/);
  for (const command of ["npm install", "npm ci", "npm test", "ls"]) {
    assert.equal(hook(bare, "pre-tool-guard.mjs", { tool_name: "Bash", tool_input: { command } }).status, 0, command);
  }
  const guarded = project({ ".npmrc": "min-release-age=7\n" });
  assert.equal(hook(guarded, "pre-tool-guard.mjs", { tool_name: "Bash", tool_input: { command: "npm i lodash" } }).status, 0);
  const uv = project({ "pyproject.toml": '[tool.uv]\nexclude-newer = "7 days"\n' });
  assert.equal(hook(uv, "pre-tool-guard.mjs", { tool_name: "Bash", tool_input: { command: "uv pip install x" } }).status, 0);
  const codexArray = hook(bare, "pre-tool-guard.mjs", { tool_name: "shell", tool_input: { command: ["bash", "-lc", "pnpm add zod"] } });
  assert.equal(codexArray.status, 2);
});

test("pre-tool-guard fails open on garbage input", () => {
  const root = project();
  const result = spawnSync(process.execPath, [join(root, "scripts/guider-hooks/pre-tool-guard.mjs")], {
    cwd: root,
    input: "not json",
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
});

test("post-edit returns lint failures to the agent", () => {
  const root = project({
    "src/a.js": "bad\n",
    ".guider-hooks.json": JSON.stringify({ lint: "grep -q bad {file} && echo 'lint: bad token' && exit 1 || exit 0" }),
  });
  const result = hook(root, "post-edit.mjs", { tool_name: "Edit", tool_input: { file_path: "src/a.js", new_string: "bad" } });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /lint failed on src\/a\.js:\nlint: bad token/);
});

test("post-edit runs the docs gate on Markdown", () => {
  const root = project({ "AGENTS.md": "line\n".repeat(200) });
  const result = hook(root, "post-edit.mjs", { tool_name: "Write", tool_input: { file_path: "AGENTS.md" } });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /docs gate failed on AGENTS\.md/);
});

test("post-edit warns, without blocking, on a security sink in the written text", () => {
  const root = project({ "src/view.js": "el.innerHTML = name;\n" });
  const result = hook(root, "post-edit.mjs", {
    tool_name: "Edit",
    tool_input: { file_path: "src/view.js", new_string: "el.innerHTML = name;" },
  });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.match(output.hookSpecificOutput.additionalContext, /raw HTML injection point/);
  const unrelated = hook(root, "post-edit.mjs", {
    tool_name: "Edit",
    tool_input: { file_path: "src/view.js", new_string: "const ok = 1;" },
  });
  assert.equal(unrelated.stdout, "");
});

test("post-edit refreshes the code graph for edited source files", () => {
  const root = project({ "src/a.js": "", "src/b.js": "" });
  spawnSync(process.execPath, ["scripts/graph.mjs", "build"], { cwd: root });
  writeFileSync(join(root, "src/b.js"), 'import "./a.js";\n');
  hook(root, "post-edit.mjs", { tool_name: "Write", tool_input: { file_path: "src/b.js", content: 'import "./a.js";' } });
  const impact = spawnSync(process.execPath, ["scripts/graph.mjs", "impact", "src/a.js", "--json"], { cwd: root, encoding: "utf8" });
  assert.deepEqual(JSON.parse(impact.stdout).direct, ["src/b.js"]);
  assert.ok(existsSync(join(root, ".guider/graph.json")));
});

test("pre-tool-guard ignores lockfile installs, redirections, flag values and local paths", () => {
  const root = project();
  const allowed = [
    "npm install > /dev/null",
    "npm i 2>&1 | tail",
    "pnpm install --filter web",
    "pip install -e .",
    "pip install -r requirements.txt",
    "npm install\nnpm test",
    "npm install ./packages/local",
  ];
  for (const command of allowed) {
    assert.equal(hook(root, "pre-tool-guard.mjs", { tool_name: "Bash", tool_input: { command } }).status, 0, command);
  }
  const blocked = ["pnpm --filter web add zod", "cd x && yarn add react", "python -m pip install requests", "npm i -D --save-exact eslint"];
  for (const command of blocked) {
    assert.equal(hook(root, "pre-tool-guard.mjs", { tool_name: "Bash", tool_input: { command } }).status, 2, command);
  }
});

test("post-edit treats a lint timeout as skipped, not failed", () => {
  const root = project({
    "src/a.js": "x\n",
    ".guider-hooks.json": JSON.stringify({
      lint: `"${process.execPath}" -e "setTimeout(() => process.exit(1), 60000)"`,
      lintTimeoutSeconds: 1,
    }),
  });
  const result = spawnSync(process.execPath, [join(root, "scripts/guider-hooks/post-edit.mjs")], {
    cwd: root,
    input: JSON.stringify({ cwd: root, tool_name: "Edit", tool_input: { file_path: "src/a.js", new_string: "x" } }),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    timeout: 40000,
  });
  assert.equal(result.status, 0, result.stderr);
});

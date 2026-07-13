import os from "os";
import path from "path";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

// Where each supported agent looks for installed skills. Both Claude and Codex
// (ChatGPT) read the same SKILL.md format, so a skill installs into either
// without conversion — only the destination directory differs.
export const TOOLS = {
  claude: {
    label: "Claude",
    global: path.join(os.homedir(), ".claude", "skills", "user"),
    project: (cwd) => path.join(cwd, ".claude", "skills"),
  },
  codex: {
    label: "Codex (ChatGPT)",
    global: path.join(os.homedir(), ".codex", "skills"),
    project: (cwd) => path.join(cwd, ".agents", "skills"),
  },
};

// Which agent are we targeting, from flags alone (no prompting)? --codex selects
// Codex, --claude selects Claude, and Claude is the default.
export function toolFromOpts(opts = {}) {
  return opts.codex ? "codex" : "claude";
}

export function globalSkillsDir(tool = "claude") {
  return TOOLS[tool].global;
}

export function projectSkillsDir(tool = "claude", cwd = process.cwd()) {
  return TOOLS[tool].project(cwd);
}

// Back-compat: Claude's global dir as a constant.
export const GLOBAL_SKILLS_DIR = TOOLS.claude.global;

// Non-interactive resolution (used by update/list): --dir > --project > global,
// scoped to the selected tool.
export function resolveSkillsDir(opts = {}) {
  if (opts.dir) return opts.dir;
  const tool = toolFromOpts(opts);
  if (opts.project) return projectSkillsDir(tool);
  return globalSkillsDir(tool);
}

// Ask a single question on the TTY and return the trimmed, lower-cased answer.
async function ask(question) {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(question)).trim().toLowerCase();
  } finally {
    rl.close();
  }
}

// Interactive tool selection (used by install): a flag wins; otherwise ask which
// agent on a TTY, and default to Claude off a TTY so scripts and CI never hang.
async function promptTool(opts = {}) {
  if (opts.codex) return "codex";
  if (opts.claude) return "claude";
  if (!stdin.isTTY) return "claude";

  const answer = await ask(
    "Which agent is this skill for?\n" +
    `  [c] ${TOOLS.claude.label}\n` +
    `  [x] ${TOOLS.codex.label}\n` +
    "Choose [c/x] (default: c): ",
  );
  return answer === "x" || answer === "codex" || answer === "chatgpt" ? "codex" : "claude";
}

// Interactive resolution (used by install): ask which agent (unless a tool flag
// is set), then ask global vs. project when no location flag is given and we're
// on a TTY. Off a TTY it falls back to the tool's global dir so nothing hangs.
export async function promptSkillsDir(opts = {}) {
  if (opts.dir) return opts.dir;
  const tool = await promptTool(opts);
  if (opts.global) return globalSkillsDir(tool);
  if (opts.project) return projectSkillsDir(tool);
  if (!stdin.isTTY) return globalSkillsDir(tool);

  const answer = await ask(
    `Where should this ${TOOLS[tool].label} skill be installed?\n` +
    `  [g] Global   ${globalSkillsDir(tool)}\n` +
    `  [p] Project  ${projectSkillsDir(tool)}\n` +
    "Choose [g/p] (default: g): ",
  );
  return answer === "p" || answer === "project" ? projectSkillsDir(tool) : globalSkillsDir(tool);
}

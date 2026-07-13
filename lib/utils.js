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

// Which agent are we targeting? --codex selects Codex; Claude is the default.
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

// Interactive resolution (used by install): prompt for global vs. project when
// no location flag is given and we're on a TTY; otherwise fall back to global
// so scripts and CI never hang. The tool is chosen by flag (--codex), default
// Claude.
export async function promptSkillsDir(opts = {}) {
  if (opts.dir) return opts.dir;
  const tool = toolFromOpts(opts);
  if (opts.global) return globalSkillsDir(tool);
  if (opts.project) return projectSkillsDir(tool);
  if (!stdin.isTTY) return globalSkillsDir(tool);

  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const answer = (
      await rl.question(
        `Where should this ${TOOLS[tool].label} skill be installed?\n` +
        `  [g] Global   ${globalSkillsDir(tool)}\n` +
        `  [p] Project  ${projectSkillsDir(tool)}\n` +
        "Choose [g/p] (default: g): ",
      )
    )
      .trim()
      .toLowerCase();
    return answer === "p" || answer === "project" ? projectSkillsDir(tool) : globalSkillsDir(tool);
  } finally {
    rl.close();
  }
}

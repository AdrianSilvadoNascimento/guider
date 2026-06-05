import os from "os";
import path from "path";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

export const GLOBAL_SKILLS_DIR = path.join(os.homedir(), ".claude", "skills", "user");

export function projectSkillsDir(cwd = process.cwd()) {
  return path.join(cwd, ".claude", "skills");
}

// Non-interactive resolution (used by update/list): --dir > --project > global.
export function resolveSkillsDir(opts = {}) {
  if (opts.dir) return opts.dir;
  if (opts.project) return projectSkillsDir();
  return GLOBAL_SKILLS_DIR;
}

// Interactive resolution (used by install): prompt for global vs. project when
// no location flag is given and we're on a TTY; otherwise fall back to global
// so scripts and CI never hang.
export async function promptSkillsDir(opts = {}) {
  if (opts.dir) return opts.dir;
  if (opts.global) return GLOBAL_SKILLS_DIR;
  if (opts.project) return projectSkillsDir();
  if (!stdin.isTTY) return GLOBAL_SKILLS_DIR;

  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const answer = (
      await rl.question(
        "Where should this skill be installed?\n" +
        `  [g] Global   ${GLOBAL_SKILLS_DIR}\n` +
        `  [p] Project  ${projectSkillsDir()}\n` +
        "Choose [g/p] (default: g): ",
      )
    )
      .trim()
      .toLowerCase();
    return answer === "p" || answer === "project" ? projectSkillsDir() : GLOBAL_SKILLS_DIR;
  } finally {
    rl.close();
  }
}

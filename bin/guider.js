#!/usr/bin/env node
import { program } from "commander";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { installSkill } from "../lib/skills/install.js";
import { updateSkill } from "../lib/skills/update.js";
import { listSkills } from "../lib/skills/list.js";
import { notifyFromCache, refreshCache } from "../lib/version-check.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8"));

// Surface a known-newer CLI version up front (instant, from cache).
notifyFromCache(pkg);

program
  .name("guider")
  .description("Manage Claude and Codex (ChatGPT) skills")
  .version(pkg.version);

const skills = program.command("skills").description("Manage skills");

skills
  .command("install <name>")
  .description("Install a skill by name or GitHub URL")
  .option("--url <url>", "Install directly from a .skill file URL")
  .option("--tag <tag>", "Pin to a specific release tag (default: latest)")
  .option("--sha256 <hex>", "Verify the downloaded archive against a SHA-256 digest")
  .option("--token <token>", "GitHub token (optional; for private repos or higher rate limits — or $GITHUB_TOKEN / $GH_TOKEN)")
  .option("--codex", "Target Codex / ChatGPT (~/.codex/skills or ./.agents/skills); skips the agent prompt")
  .option("--claude", "Target Claude (~/.claude/skills); skips the agent prompt")
  .option("--global", "Install for all projects (Claude: ~/.claude/skills/user, Codex: ~/.codex/skills)")
  .option("--project", "Install into the current project (Claude: ./.claude/skills, Codex: ./.agents/skills)")
  .option("--dir <path>", "Explicit target skills directory (overrides --global/--project)")
  .action(installSkill);

skills
  .command("update [name]")
  .description("Update an installed skill to its latest version (omit name to update all)")
  .option("--tag <tag>", "Pin to a specific release tag (default: latest)")
  .option("--token <token>", "GitHub token (optional; for private repos or higher rate limits — or $GITHUB_TOKEN / $GH_TOKEN)")
  .option("--codex", "Target Codex / ChatGPT (~/.codex/skills or ./.agents/skills) instead of Claude")
  .option("--project", "Update skills in the current project (Claude: ./.claude/skills, Codex: ./.agents/skills)")
  .option("--dir <path>", "Explicit target skills directory (default: the tool's global dir)")
  .action(updateSkill);

skills
  .command("list")
  .description("List installed skills")
  .option("--codex", "List Codex / ChatGPT skills (~/.codex/skills or ./.agents/skills) instead of Claude")
  .option("--project", "List skills in the current project (Claude: ./.claude/skills, Codex: ./.agents/skills)")
  .option("--dir <path>", "Explicit target skills directory (default: the tool's global dir)")
  .action(listSkills);

// Run the command, then refresh the update cache (bounded; shows next run).
await program.parseAsync();
await refreshCache(pkg);

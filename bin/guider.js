#!/usr/bin/env node
import { program } from "commander";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { installSkill } from "../lib/skills/install.js";
import { updateSkill } from "../lib/skills/update.js";
import { listSkills } from "../lib/skills/list.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8"));

program
  .name("guider")
  .description("Manage Claude skills")
  .version(pkg.version);

const skills = program.command("skills").description("Manage skills");

skills
  .command("install <name>")
  .description("Install a skill by name or GitHub URL")
  .option("--url <url>", "Install directly from a .skill file URL")
  .option("--tag <tag>", "Pin to a specific release tag (default: latest)")
  .option("--sha256 <hex>", "Verify the downloaded archive against a SHA-256 digest")
  .option("--dir <path>", "Target skills directory (default: ~/.claude/skills/user)")
  .action(installSkill);

skills
  .command("update [name]")
  .description("Update an installed skill to its latest version (omit name to update all)")
  .option("--tag <tag>", "Pin to a specific release tag (default: latest)")
  .option("--dir <path>", "Target skills directory (default: ~/.claude/skills/user)")
  .action(updateSkill);

skills
  .command("list")
  .description("List installed skills")
  .option("--dir <path>", "Target skills directory (default: ~/.claude/skills/user)")
  .action(listSkills);

program.parse();

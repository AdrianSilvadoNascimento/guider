import fs from "fs";
import chalk from "chalk";
import { installSkill } from "./install.js";
import { resolveSkillsDir } from "../utils.js";
import { REGISTRY } from "./registry.js";

export async function updateSkill(name, opts) {
  // Update in place — resolve the dir once and pass it down so install never
  // prompts for a location.
  const skillsDir = resolveSkillsDir(opts);
  const optsWithDir = { ...opts, dir: skillsDir };

  // Update a single named skill
  if (name) {
    await installSkill(name, optsWithDir);
    return;
  }

  // No name given — update every installed skill that exists in the registry
  const installed = fs.existsSync(skillsDir)
    ? fs.readdirSync(skillsDir).filter((f) =>
        fs.statSync(`${skillsDir}/${f}`).isDirectory()
      )
    : [];

  const updatable = installed.filter((s) => REGISTRY[s]);

  if (updatable.length === 0) {
    console.log(chalk.yellow("No installed skills found in registry to update."));
    return;
  }

  console.log(chalk.dim(`Updating ${updatable.length} skill(s)...\n`));
  for (const skill of updatable) {
    await installSkill(skill, optsWithDir);
  }
}

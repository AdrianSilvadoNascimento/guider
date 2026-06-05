import fs from "fs";
import path from "path";
import chalk from "chalk";
import { resolveSkillsDir } from "../utils.js";

// Minimal YAML frontmatter parser covering the shapes skills actually use:
// inline scalars, quoted scalars, and block scalars (`>`, `|`, with `+`/`-`).
function parseFrontmatter(skillDir) {
  try {
    const content = fs.readFileSync(path.join(skillDir, "SKILL.md"), "utf8");
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};

    const lines = match[1].split("\n");
    const fields = {};

    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^([A-Za-z0-9_-]+):\s?(.*)$/);
      if (!m) continue;
      const [, key, rawValue] = m;

      if (/^[|>][+-]?\s*$/.test(rawValue)) {
        // Block scalar: gather following blank or indented lines.
        const folded = rawValue.startsWith(">");
        const collected = [];
        while (i + 1 < lines.length && (lines[i + 1].trim() === "" || /^\s/.test(lines[i + 1]))) {
          collected.push(lines[++i].trim());
        }
        fields[key] = collected.join(folded ? " " : "\n").trim();
      } else {
        fields[key] = rawValue.trim().replace(/^["']|["']$/g, "");
      }
    }

    return { name: fields.name, desc: fields.description };
  } catch {
    return {};
  }
}

export function listSkills(opts) {
  const skillsDir = resolveSkillsDir(opts);

  if (!fs.existsSync(skillsDir)) {
    console.log(chalk.yellow(`No skills directory found at ${skillsDir}`));
    return;
  }

  const entries = fs
    .readdirSync(skillsDir)
    .filter((f) => fs.statSync(path.join(skillsDir, f)).isDirectory());

  if (entries.length === 0) {
    console.log(chalk.yellow("No skills installed."));
    return;
  }

  console.log(chalk.bold(`\nInstalled skills (${skillsDir})\n`));
  for (const dir of entries) {
    const { name, desc } = parseFrontmatter(path.join(skillsDir, dir));
    console.log(`  ${chalk.cyan(name ?? dir)}`);
    if (desc) console.log(`  ${chalk.dim(desc)}\n`);
  }
}

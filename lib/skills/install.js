import fs from "fs";
import path from "path";
import crypto from "crypto";
import AdmZip from "adm-zip";
import chalk from "chalk";
import ora from "ora";
import { resolve } from "./registry.js";
import { download, resolveToken } from "./download.js";
import { assertSafeEntries } from "./safe-extract.js";
import { promptSkillsDir } from "../utils.js";

export async function installSkill(name, opts) {
  const skillsDir = await promptSkillsDir(opts);

  let source;
  try {
    source = resolve(name, opts);
  } catch (err) {
    console.error(chalk.red(`✗ ${err.message}`));
    process.exit(1);
  }

  const token = resolveToken(opts.token);

  // The real folder name lives inside the archive, so the final label is
  // resolved once the zip has been read.
  const spinner = ora(`Installing ${chalk.bold(name)}...`).start();

  try {
    const buffer = await download(source, token);

    // Optional integrity check before we trust the archive.
    if (opts.sha256) {
      const digest = crypto.createHash("sha256").update(buffer).digest("hex");
      if (digest.toLowerCase() !== opts.sha256.toLowerCase()) {
        throw new Error(`Checksum mismatch — expected ${opts.sha256}, got ${digest}.`);
      }
    }

    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    if (entries.length === 0) throw new Error("Archive is empty — nothing to install.");

    // Refuse zip-slip and derive the skill folder from the archive.
    const topLevel = assertSafeEntries(entries.map((e) => e.entryName), skillsDir);
    const folder = topLevel.size === 1 ? [...topLevel][0] : name;
    const destDir = path.join(skillsDir, folder);
    const alreadyInstalled = fs.existsSync(destDir);
    spinner.text = `${alreadyInstalled ? "Reinstalling" : "Installing"} ${chalk.bold(folder)}...`;

    fs.mkdirSync(skillsDir, { recursive: true });
    zip.extractAllTo(skillsDir, true); // overwrite existing

    spinner.succeed(
      chalk.green(`✓ ${alreadyInstalled ? "Reinstalled" : "Installed"} `) +
      chalk.bold(folder) +
      chalk.dim(` → ${destDir}`)
    );
  } catch (err) {
    spinner.fail(chalk.red(`✗ ${err.message}`));
    process.exit(1);
  }
}

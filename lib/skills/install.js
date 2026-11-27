import fs from "fs";
import path from "path";
import crypto from "crypto";
import AdmZip from "adm-zip";
import chalk from "chalk";
import ora from "ora";
import { resolve } from "./registry.js";
import { download, resolveToken, resolveQuarantineDays } from "./download.js";
import { assertSafeEntries } from "./safe-extract.js";
import { promptSkillsDir } from "../utils.js";
import { isNewer } from "../version-check.js";

// Written into the installed skill folder so a later update can tell which
// release is there and never downgrade it silently.
export const RELEASE_MARKER = ".guider-release.json";

function readMarker(destDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(destDir, RELEASE_MARKER), "utf8"));
  } catch {
    return null;
  }
}

export async function installSkill(name, opts) {
  const skillsDir = await promptSkillsDir(opts);

  let source;
  let quarantineDays;
  try {
    source = resolve(name, opts);
    quarantineDays = resolveQuarantineDays(opts);
  } catch (err) {
    console.error(chalk.red(`✗ ${err.message}`));
    process.exit(1);
  }

  const token = resolveToken(opts.token);

  if (source.kind === "url" && quarantineDays > 0) {
    console.warn(chalk.yellow("! --url has no publish date, so the release quarantine can't apply. Pin it with --sha256."));
  }

  // The real folder name lives inside the archive, so the final label is
  // resolved once the zip has been read.
  const spinner = ora(`Installing ${chalk.bold(name)}...`).start();

  try {
    let release = null;
    const buffer = await download(source, token, {
      quarantineDays,
      onRelease: (chosen) => {
        release = chosen;
      },
    });

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

    // The quarantine picks an older release than `latest`; never let that
    // replace a newer copy that is already installed (unless a tag was pinned).
    const installed = alreadyInstalled ? readMarker(destDir) : null;
    if (release?.tag_name && installed?.tag && !opts.tag && isNewer(installed.tag.replace(/^v/, ""), release.tag_name.replace(/^v/, ""))) {
      spinner.warn(
        chalk.yellow(`! Kept ${folder} ${installed.tag}: the newest release past the quarantine is ${release.tag_name}, which is older. `) +
        chalk.dim("Pass --allow-fresh to move to the latest release."),
      );
      return;
    }
    spinner.text = `${alreadyInstalled ? "Reinstalling" : "Installing"} ${chalk.bold(folder)}...`;

    fs.mkdirSync(skillsDir, { recursive: true });
    zip.extractAllTo(skillsDir, true); // overwrite existing
    if (release?.tag_name) {
      fs.writeFileSync(
        path.join(destDir, RELEASE_MARKER),
        `${JSON.stringify({ tag: release.tag_name, publishedAt: release.published_at ?? null })}\n`,
      );
    }

    spinner.succeed(
      chalk.green(`✓ ${alreadyInstalled ? "Reinstalled" : "Installed"} `) +
      chalk.bold(folder) +
      (release?.tag_name ? ` ${release.tag_name}` : "") +
      chalk.dim(` → ${destDir}`)
    );
  } catch (err) {
    spinner.fail(chalk.red(`✗ ${err.message}`));
    process.exit(1);
  }
}

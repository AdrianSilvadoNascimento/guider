import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import AdmZip from "adm-zip";

// Build dist/guider.skill from skill-src/guider/. The archive must contain a
// single top-level `guider/` folder so the installer extracts it correctly.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcDir = path.join(root, "skill-src", "guider");
const outDir = path.join(root, "dist");
const outFile = path.join(outDir, "guider.skill");

if (!fs.existsSync(path.join(srcDir, "SKILL.md"))) {
  console.error(`✗ No SKILL.md found in ${srcDir}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const zip = new AdmZip();
zip.addLocalFolder(srcDir, "guider");
zip.writeZip(outFile);

const { size } = fs.statSync(outFile);
const sha256 = crypto.createHash("sha256").update(fs.readFileSync(outFile)).digest("hex");
console.log(`✓ Built ${path.relative(root, outFile)} — ${zip.getEntries().length} entries, ${(size / 1024).toFixed(1)} kB`);
console.log(`  sha256: ${sha256}`);

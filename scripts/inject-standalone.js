/**
 * electron-builder strips node_modules from extraResources by design.
 * This script runs AFTER `electron-builder --win dir` to manually copy
 * the full standalone folder (including node_modules) into win-unpacked,
 * then calls electron-builder to create the NSIS installer from that
 * pre-packaged directory.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const src = path.join(root, ".next", "standalone");
const dest = path.join(root, "dist-installer", "win-unpacked", "resources", "standalone");

if (!fs.existsSync(src)) {
  console.error("Error: .next/standalone not found. Run `next build` first.");
  process.exit(1);
}

if (!fs.existsSync(path.join(root, "dist-installer", "win-unpacked"))) {
  console.error("Error: dist-installer/win-unpacked not found. Run electron-builder --win dir first.");
  process.exit(1);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    const s = path.join(src, item);
    const d = path.join(dest, item);
    if (fs.statSync(s).isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

console.log("→ Copying standalone (with node_modules) into win-unpacked...");
if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
copyDir(src, dest);
console.log("✓ Standalone injected");

console.log("→ Building NSIS installer from pre-packaged directory...");
execSync("npx electron-builder --win nsis --prepackaged dist-installer/win-unpacked", {
  cwd: root,
  stdio: "inherit",
});
console.log("✓ NSIS installer built");

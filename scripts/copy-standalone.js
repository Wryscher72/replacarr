/**
 * After `next build`, the standalone output needs two extra folders copied in:
 *   .next/static  → .next/standalone/.next/static
 *   public        → .next/standalone/public
 *
 * Run this before electron-builder so the packaged resources are complete.
 */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");

if (!fs.existsSync(standalone)) {
  console.error("Error: .next/standalone not found. Run `next build` first.");
  process.exit(1);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
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

// 1. .next/static → .next/standalone/.next/static
copyDir(
  path.join(root, ".next", "static"),
  path.join(standalone, ".next", "static")
);
console.log("✓ Copied .next/static → standalone/.next/static");

// 2. public → .next/standalone/public
copyDir(
  path.join(root, "public"),
  path.join(standalone, "public")
);
console.log("✓ Copied public → standalone/public");

console.log("✓ Standalone ready for packaging");

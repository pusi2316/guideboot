#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { copyFileSync, chmodSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const rustDir = join(repoRoot, "rust-video-processor");
const binDir = join(repoRoot, "bin");

console.log("[guidepilot] Building Rust video processor (cargo build --release)...");
const build = spawnSync("cargo", ["build", "--release"], {
  cwd: rustDir,
  stdio: "inherit",
});

if (build.status !== 0) {
  console.error("[guidepilot] cargo build failed.");
  process.exit(build.status ?? 1);
}

const binaryName = process.platform === "win32" ? "video-processor.exe" : "video-processor";
const builtPath = join(rustDir, "target", "release", binaryName);

if (!existsSync(builtPath)) {
  console.error(`[guidepilot] Expected built binary at ${builtPath} but it wasn't found.`);
  process.exit(1);
}

if (!existsSync(binDir)) {
  mkdirSync(binDir, { recursive: true });
}

const destPath = join(binDir, binaryName);
copyFileSync(builtPath, destPath);
if (process.platform !== "win32") {
  chmodSync(destPath, 0o755);
}

console.log(`[guidepilot] Copied binary to ${destPath}`);

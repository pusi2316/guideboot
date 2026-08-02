import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

import type { VideoProcessingJob } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Resolves the video-processor binary path.
 * Override with GUIDEPILOT_BINARY_PATH for a fully custom location.
 * Otherwise prefers the packaged bin/ copy (what `npm run build` produces
 * and what ships to consumers), falling back to the local cargo build
 * output directly for dev.
 */
export function resolveBinaryPath(): string {
  const override = process.env.GUIDEPILOT_BINARY_PATH;
  if (override) {
    return override;
  }

  const binaryName = process.platform === "win32" ? "video-processor.exe" : "video-processor";
  const candidates = [
    join(__dirname, "..", "bin", binaryName),
    join(__dirname, "..", "rust-video-processor", "target", "release", binaryName),
    join(__dirname, "..", "rust-video-processor", "target", "debug", binaryName),
  ];

  const found = candidates.find((path) => existsSync(path));
  if (!found) {
    throw new Error(
      `Could not find the video-processor binary. Build it with "npm run build:rust", or set ` +
        `GUIDEPILOT_BINARY_PATH explicitly.`,
    );
  }
  return found;
}

/**
 * Writes the job to a temp video-job.json, runs the Rust binary against it,
 * and cleans up the temp file afterward.
 */
export async function processVideo(job: VideoProcessingJob): Promise<void> {
  const binaryPath = resolveBinaryPath();

  const workDir = await mkdtemp(join(tmpdir(), "guidepilot-"));
  const jobPath = join(workDir, "video-job.json");
  await writeFile(jobPath, JSON.stringify(job, null, 2), "utf-8");

  try {
    await runBinary(binaryPath, ["--job", jobPath]);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

function runBinary(binaryPath: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, args, { stdio: ["ignore", "inherit", "inherit"] });

    child.on("error", (err) => {
      reject(new Error(`Failed to spawn ${binaryPath}: ${err.message}`));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${binaryPath} exited with code ${code}`));
      }
    });
  });
}

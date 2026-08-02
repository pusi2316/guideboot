#!/usr/bin/env node
import { spawnSync } from "node:child_process";

if (process.env.GUIDEPILOT_SKIP_BROWSER_INSTALL) {
  console.log(
    "[guidepilot] GUIDEPILOT_SKIP_BROWSER_INSTALL set, skipping Playwright browser install.",
  );
  process.exit(0);
}

console.log("[guidepilot] Installing Playwright's Chromium browser...");
const result = spawnSync("npx", ["playwright", "install", "chromium"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.status !== 0) {
  console.warn(
    "[guidepilot] Playwright's bundled Chromium could not be installed on this machine.\n" +
      "[guidepilot] If the error above mentions an unsupported OS (e.g. mac12), Playwright is " +
      "refusing to download its own build for your OS version — this doesn't mean the browser " +
      "itself won't run.\n" +
      "[guidepilot] Fix: install Google Chrome normally, then set GUIDEPILOT_BROWSER_CHANNEL=chrome " +
      "in your environment before running `guidepilot generate`. It will drive your system Chrome " +
      "instead of downloading Playwright's own build.",
  );
}

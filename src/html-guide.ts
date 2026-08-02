import { writeFile } from "node:fs/promises";
import { dirname, relative } from "node:path";

import type { RecordedStep } from "./types.js";

/** Generates a self-contained, styled HTML guide from the recorded steps. */
export async function generateHtml(
  goal: string,
  steps: RecordedStep[],
  videoPath: string,
  outputPath: string,
): Promise<void> {
  const stepsHtml = steps
    .map((step, i) => {
      const imgSrc = escapeHtml(relative(dirname(outputPath), step.screenshotPath));
      return `    <section class="step">
      <h2>Step ${i + 1}</h2>
      <p>${escapeHtml(step.description)}</p>
      <img src="${imgSrc}" alt="${escapeHtml(step.description)}" loading="lazy" />
    </section>`;
    })
    .join("\n");

  const videoSrc = escapeHtml(relative(dirname(outputPath), videoPath));

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(goal)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { color-scheme: light dark; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    max-width: 860px;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
    line-height: 1.5;
  }
  h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
  video { width: 100%; border-radius: 8px; margin: 1.5rem 0; }
  .step { margin: 2.5rem 0; }
  .step h2 {
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #888;
    margin-bottom: 0.5rem;
  }
  .step p { font-size: 1.1rem; margin: 0 0 0.75rem; }
  .step img {
    width: 100%;
    border-radius: 8px;
    border: 1px solid rgba(128, 128, 128, 0.3);
  }
</style>
</head>
<body>
  <h1>${escapeHtml(goal)}</h1>
  <video controls src="${videoSrc}"></video>
${stepsHtml}
</body>
</html>
`;

  await writeFile(outputPath, html, "utf-8");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

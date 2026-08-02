import { writeFile } from "node:fs/promises";
import { dirname, relative } from "node:path";

import type { RecordedStep } from "./types.js";

/** Generates a Markdown guide document from the recorded steps. */
export async function generateMarkdown(
  goal: string,
  steps: RecordedStep[],
  outputPath: string,
): Promise<void> {
  const lines: string[] = [`# ${goal}`, ""];

  steps.forEach((step, i) => {
    const imgPath = relative(dirname(outputPath), step.screenshotPath);
    lines.push(`## Step ${i + 1}: ${step.description}`);
    lines.push("");
    lines.push(`![${step.description}](${imgPath})`);
    lines.push("");
  });

  await writeFile(outputPath, lines.join("\n"), "utf-8");
}

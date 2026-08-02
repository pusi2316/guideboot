import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";

import { generate } from "./index.js";
import type { Viewport } from "./types.js";

const DEFAULT_VIEWPORT: Viewport = { width: 1280, height: 800 };
const DEFAULT_MAX_STEPS = 15;

const program = new Command();

program
  .name("guidepilot")
  .description("Generate a developer guide by having an AI agent navigate your web app")
  .version("0.1.0");

program
  .command("generate")
  .description("Navigate to a URL and record a guide for the given goal")
  .argument("<url>", "URL of the web app to navigate")
  .argument("<goal>", 'What the guide should accomplish, e.g. "show how to create a user"')
  .option("-o, --output-dir <dir>", "Directory to write the guide into", "./guidepilot-output")
  .option("--max-steps <n>", "Maximum number of actions the agent may take", String(DEFAULT_MAX_STEPS))
  .option("--width <n>", "Viewport width", String(DEFAULT_VIEWPORT.width))
  .option("--height <n>", "Viewport height", String(DEFAULT_VIEWPORT.height))
  .action(async (url: string, goal: string, opts) => {
    const spinner = ora(`Navigating to ${url}...`).start();
    try {
      const result = await generate({
        url,
        goal,
        outputDir: opts.outputDir,
        maxSteps: Number(opts.maxSteps),
        viewport: { width: Number(opts.width), height: Number(opts.height) },
      });

      spinner.succeed(chalk.green(`Guide generated: ${result.htmlPath}`));
      console.log(chalk.dim(`  Markdown: ${result.markdownPath}`));
      console.log(chalk.dim(`  Video:    ${result.processedVideoPath}`));
      console.log(chalk.dim(`  Steps recorded: ${result.steps.length}`));
    } catch (err) {
      spinner.fail(chalk.red(`Guide generation failed: ${(err as Error).message}`));
      process.exitCode = 1;
    }
  });

program.parse(process.argv);

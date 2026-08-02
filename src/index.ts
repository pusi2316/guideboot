import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { BrowserController, captureDomSnapshot, executeAction } from "./browser.js";
import { generateMarkdown } from "./document.js";
import { generateHtml } from "./html-guide.js";
import { Navigator } from "./navigator.js";
import { retry } from "./retry.js";
import type {
  GenerateOptions,
  GenerateResult,
  RecordedStep,
  Viewport,
  VideoProcessingJob,
  ZoomInfo,
} from "./types.js";
import { processVideo } from "./video.js";

/** Per-action-type zoom heuristics; actions not listed here get no zoom. */
const ZOOM_DEFAULTS: Partial<Record<string, { zoomFactor: number; durationMs: number; paddingPx: number }>> = {
  click: { zoomFactor: 2.5, durationMs: 2000, paddingPx: 40 },
  type: { zoomFactor: 2.0, durationMs: 1800, paddingPx: 30 },
};

export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const { url, goal, outputDir, maxSteps, viewport } = options;

  await mkdir(outputDir, { recursive: true });
  const screenshotsDir = join(outputDir, "screenshots");
  await mkdir(screenshotsDir, { recursive: true });
  const videoDir = join(outputDir, "raw-video");
  await mkdir(videoDir, { recursive: true });

  const { recordedSteps, rawVideoPath } = await recordSession({
    url,
    goal,
    maxSteps,
    viewport,
    videoDir,
    screenshotsDir,
  });

  const processedVideoPath = join(outputDir, "guide.mp4");
  const job = buildVideoJob(recordedSteps, rawVideoPath, processedVideoPath, viewport);
  await processVideo(job);

  const markdownPath = join(outputDir, "guide.md");
  await generateMarkdown(goal, recordedSteps, markdownPath);

  const htmlPath = join(outputDir, "guide.html");
  await generateHtml(goal, recordedSteps, processedVideoPath, htmlPath);

  return {
    steps: recordedSteps,
    rawVideoPath,
    processedVideoPath,
    markdownPath,
    htmlPath,
  };
}

interface RecordSessionOptions {
  url: string;
  goal: string;
  maxSteps: number;
  viewport: Viewport;
  videoDir: string;
  screenshotsDir: string;
}

async function recordSession(
  options: RecordSessionOptions,
): Promise<{ recordedSteps: RecordedStep[]; rawVideoPath: string }> {
  const { url, goal, maxSteps, viewport, videoDir, screenshotsDir } = options;

  const navigator = new Navigator();
  const controller = new BrowserController();
  const page = await controller.launch(viewport, videoDir);

  try {
    await page.goto(url);
    const startTime = Date.now();
    const recordedSteps: RecordedStep[] = [];

    for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
      const snapshot = await captureDomSnapshot(page);
      const action = await navigator.planNextAction(goal, snapshot);

      if (action.type === "done") {
        break;
      }

      const boundingBox = await retry(() => executeAction(page, action), {
        attempts: 3,
        baseDelayMs: 500,
      });

      const screenshotPath = join(screenshotsDir, `step-${stepIndex}.png`);
      await controller.screenshot(screenshotPath);

      recordedSteps.push({
        stepIndex,
        timestampMs: Date.now() - startTime,
        description: action.description,
        action,
        boundingBox,
        screenshotPath,
      });
    }

    const rawVideoPath = await controller.close();
    return { recordedSteps, rawVideoPath };
  } catch (err) {
    await controller.close().catch(() => {});
    throw err;
  }
}

function buildVideoJob(
  steps: RecordedStep[],
  inputVideo: string,
  outputVideo: string,
  viewport: Viewport,
): VideoProcessingJob {
  return {
    inputVideo,
    outputVideo,
    viewport,
    steps: steps.map((step) => ({
      stepIndex: step.stepIndex,
      timestampMs: step.timestampMs,
      description: step.description,
      zoom: buildZoomInfo(step),
    })),
  };
}

function buildZoomInfo(step: RecordedStep): ZoomInfo | null {
  const defaults = ZOOM_DEFAULTS[step.action.type];
  if (!defaults || !step.boundingBox) {
    return null;
  }

  const { x, y, width, height } = step.boundingBox;
  return {
    targetX: x,
    targetY: y,
    targetWidth: width,
    targetHeight: height,
    zoomFactor: defaults.zoomFactor,
    durationMs: defaults.durationMs,
    paddingPx: defaults.paddingPx,
  };
}

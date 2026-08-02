import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "playwright";

import type { AgentAction, BoundingBox, DomSnapshot, Viewport } from "./types.js";

/** Attribute stamped onto candidate elements so actions can locate them by ref. */
const REF_ATTR = "data-guidepilot-ref";

export class BrowserController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  page: Page | null = null;

  async launch(viewport: Viewport, videoDir: string): Promise<Page> {
    // On OSes where Playwright refuses to install its own bundled Chromium
    // (e.g. "Playwright does not support chromium on mac12"), fall back to
    // an already-installed system browser via the channel option instead.
    const channel = process.env.GUIDEPILOT_BROWSER_CHANNEL || undefined;
    this.browser = await chromium.launch({ channel });
    this.context = await this.browser.newContext({
      viewport,
      deviceScaleFactor: 1,
      recordVideo: { dir: videoDir, size: viewport },
    });
    this.page = await this.context.newPage();
    return this.page;
  }

  async screenshot(path: string): Promise<void> {
    if (!this.page) {
      throw new Error("Browser not launched");
    }
    await this.page.screenshot({ path });
  }

  /** Closes the browser and returns the path to the recorded .webm. */
  async close(): Promise<string> {
    if (!this.page || !this.context || !this.browser) {
      throw new Error("Browser not launched");
    }
    const video = this.page.video();
    if (!video) {
      throw new Error("No video was recorded for this session");
    }
    await this.context.close();
    await this.browser.close();
    return video.path();
  }
}

/**
 * Serializes the currently visible interactive elements on the page into a
 * compact snapshot for Claude, stamping each with a stable ref attribute so
 * a planned action can be resolved back to a real element.
 */
export async function captureDomSnapshot(page: Page): Promise<DomSnapshot> {
  const elements = await page.evaluate((refAttr) => {
    const SELECTOR =
      'a,button,input,select,textarea,[role],[onclick],[tabindex]:not([tabindex="-1"])';
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR));

    function isVisible(el: HTMLElement): boolean {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return false;
      }
      const style = window.getComputedStyle(el);
      return style.visibility !== "hidden" && style.display !== "none";
    }

    const results: Array<{
      ref: string;
      tag: string;
      role?: string;
      ariaLabel?: string;
      testId?: string;
      placeholder?: string;
      text?: string;
      boundingBox: { x: number; y: number; width: number; height: number };
    }> = [];

    let index = 0;
    const MAX_ELEMENTS = 75;
    for (const el of candidates) {
      if (results.length >= MAX_ELEMENTS) {
        break;
      }
      if (!isVisible(el)) {
        continue;
      }

      const ref = `gp-${index++}`;
      el.setAttribute(refAttr, ref);

      const rect = el.getBoundingClientRect();
      const text = (el.innerText || el.getAttribute("value") || "").trim().slice(0, 80);

      results.push({
        ref,
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute("role") ?? undefined,
        ariaLabel: el.getAttribute("aria-label") ?? undefined,
        testId: el.getAttribute("data-testid") ?? undefined,
        placeholder: el.getAttribute("placeholder") ?? undefined,
        text: text || undefined,
        boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      });
    }

    return results;
  }, REF_ATTR);

  return {
    url: page.url(),
    title: await page.title(),
    elements,
  };
}

/** Executes a planned action against the page, returning the acted-on element's bounding box, if any. */
export async function executeAction(page: Page, action: AgentAction): Promise<BoundingBox | null> {
  switch (action.type) {
    case "click": {
      const locator = requireLocator(page, action);
      const box = await locator.boundingBox();
      await locator.click();
      return box;
    }
    case "type": {
      const locator = requireLocator(page, action);
      const box = await locator.boundingBox();
      await locator.fill(action.text ?? "");
      return box;
    }
    case "scroll": {
      await page.mouse.wheel(0, 600);
      return null;
    }
    case "wait": {
      await page.waitForTimeout(action.waitMs ?? 1000);
      return null;
    }
    case "done":
      return null;
  }
}

function requireLocator(page: Page, action: AgentAction): Locator {
  if (!action.targetRef) {
    throw new Error(`Action of type "${action.type}" requires a targetRef`);
  }
  return page.locator(`[${REF_ATTR}="${action.targetRef}"]`);
}

import Anthropic from "@anthropic-ai/sdk";

import { retry } from "./retry.js";
import type { AgentAction, DomSnapshot } from "./types.js";

const MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `You are an expert product guide creator. You control a real web browser via a \
tool call and must navigate the given web app to accomplish the user's goal, one action at a time.

Rules:
- Always call the browser_action tool with exactly one action.
- Prefer the most obviously relevant element, judging by its aria-label, visible text, placeholder, or test id.
- Write "description" as a short, present-tense instruction a human reader would follow, e.g. "Click the Login button".
- When the goal has been fully accomplished, respond with type "done".
- Never invent a targetRef that wasn't present in the provided element list.`;

const BROWSER_ACTION_TOOL: Anthropic.Tool = {
  name: "browser_action",
  description:
    "Perform the next action in the browser to progress toward the goal, or report done when the goal is complete.",
  input_schema: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["click", "type", "scroll", "wait", "done"],
      },
      description: {
        type: "string",
        description: "Human-readable summary of this step, written for someone following a guide.",
      },
      targetRef: {
        type: "string",
        description: "The ref of the element to act on, from the provided element list. Required for click/type.",
      },
      text: {
        type: "string",
        description: "Text to type. Required for type actions.",
      },
      waitMs: {
        type: "number",
        description: "Milliseconds to wait. Used for wait actions.",
      },
    },
    required: ["type", "description"],
  },
};

/**
 * Wraps the Claude agentic loop: maintains conversation history across
 * steps so the model has full context of what it has already tried.
 */
export class Navigator {
  private client: Anthropic;
  private history: Anthropic.MessageParam[] = [];

  constructor(apiKey: string | undefined = process.env.ANTHROPIC_API_KEY) {
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    this.client = new Anthropic({ apiKey });
  }

  async planNextAction(goal: string, snapshot: DomSnapshot): Promise<AgentAction> {
    this.history.push({ role: "user", content: buildUserMessage(goal, snapshot) });

    const response = await retry(
      () =>
        this.client.messages.create({
          model: MODEL,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: this.history,
          tools: [BROWSER_ACTION_TOOL],
          tool_choice: { type: "tool", name: BROWSER_ACTION_TOOL.name },
        }),
      { attempts: 3, baseDelayMs: 1000 },
    );

    this.history.push({ role: "assistant", content: response.content });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );
    if (!toolUse) {
      throw new Error("Claude did not return a browser_action tool call");
    }

    return toolUse.input as AgentAction;
  }
}

function buildUserMessage(goal: string, snapshot: DomSnapshot): string {
  const elementsSummary = snapshot.elements.map((el) => ({
    ref: el.ref,
    tag: el.tag,
    role: el.role,
    ariaLabel: el.ariaLabel,
    testId: el.testId,
    placeholder: el.placeholder,
    text: el.text,
  }));

  return [
    `Goal: ${goal}`,
    `Current page: ${snapshot.title} (${snapshot.url})`,
    `Visible interactive elements:`,
    JSON.stringify(elementsSummary, null, 2),
    `What is the next action?`,
  ].join("\n\n");
}

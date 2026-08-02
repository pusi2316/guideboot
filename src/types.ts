// --- video-job.json contract -------------------------------------------
// Mirrors rust-video-processor/src/types.rs — field names must match the
// #[serde(rename = "...")] attributes there exactly, since this is what
// gets serialized to video-job.json and read by the Rust binary.

export interface Viewport {
  width: number;
  height: number;
}

export interface ZoomInfo {
  targetX: number;
  targetY: number;
  targetWidth: number;
  targetHeight: number;
  zoomFactor: number;
  durationMs: number;
  paddingPx?: number;
}

export interface VideoStep {
  stepIndex: number;
  timestampMs: number;
  description: string;
  zoom: ZoomInfo | null;
}

export interface VideoProcessingJob {
  inputVideo: string;
  outputVideo: string;
  viewport: Viewport;
  steps: VideoStep[];
}

// --- Browser / DOM snapshot ----------------------------------------------

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A single interactive element as surfaced to Claude for action planning. */
export interface DomElementSnapshot {
  ref: string;
  tag: string;
  role?: string;
  ariaLabel?: string;
  testId?: string;
  placeholder?: string;
  text?: string;
  boundingBox: BoundingBox;
}

export interface DomSnapshot {
  url: string;
  title: string;
  elements: DomElementSnapshot[];
}

// --- AI agent action planning ---------------------------------------------

export type AgentActionType = "click" | "type" | "scroll" | "wait" | "done";

export interface AgentAction {
  type: AgentActionType;
  /** Human-readable description of this step, used verbatim in the guide doc. */
  description: string;
  /** ref of the DomElementSnapshot to act on; required for click/type. */
  targetRef?: string;
  /** Text to type; required for type actions. */
  text?: string;
  /** Milliseconds to wait; used for wait actions. */
  waitMs?: number;
}

// --- Recording ---------------------------------------------------------

export interface RecordedStep {
  stepIndex: number;
  timestampMs: number;
  description: string;
  action: AgentAction;
  boundingBox: BoundingBox | null;
  screenshotPath: string;
}

export interface GenerateOptions {
  url: string;
  goal: string;
  outputDir: string;
  maxSteps: number;
  viewport: Viewport;
}

export interface GenerateResult {
  steps: RecordedStep[];
  rawVideoPath: string;
  processedVideoPath: string;
  markdownPath: string;
  htmlPath: string;
}

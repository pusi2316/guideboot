use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct VideoProcessingJob {
    #[serde(rename = "inputVideo")]
    pub input_video: String,

    #[serde(rename = "outputVideo")]
    pub output_video: String,

    pub viewport: Viewport,
    pub steps: Vec<VideoStep>,
}

#[derive(Debug, Deserialize)]
pub struct Viewport {
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Deserialize)]
pub struct ZoomInfo {
    #[serde(rename = "targetX")]
    pub target_x: f64,
    #[serde(rename = "targetY")]
    pub target_y: f64,
    #[serde(rename = "targetHeight")]
    pub target_h: f64,
    #[serde(rename = "targetWidth")]
    pub target_w: f64,
    #[serde(rename = "zoomFactor")]
    pub zoom_factor: f64,
    #[serde(rename = "durationMs")]
    pub duration_ms: u64,
    #[serde(rename = "paddingPx")]
    pub padding: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct VideoStep {
    #[serde(rename = "stepIndex")]
    pub step_index: u32,

    #[serde(rename = "timestampMs")]
    pub timestamp_ms: u64,

    pub description: String,

    pub zoom: Option<ZoomInfo>,
}

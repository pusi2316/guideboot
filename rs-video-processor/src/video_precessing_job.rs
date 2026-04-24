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

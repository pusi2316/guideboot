use crate::types::{VideoProcessingJob, Viewport, ZoomInfo};

pub struct ZoomSegment {
    pub start_ms: u64,
    pub end_ms: u64,
    pub crop_x: f64,
    pub crop_y: f64,
    pub crop_w: f64,
    pub crop_h: f64,
}

impl ZoomSegment {
    pub fn from_steps(zoom_info: &ZoomInfo, start_ms: u64, viewport: &Viewport) -> Self {
        let vw = viewport.width as f64;
        let vh = viewport.height as f64;
        let pad = zoom_info.padding.unwrap_or(0.0);

        let crop_x = (zoom_info.target_x - pad).max(0.0);
        let crop_y = (zoom_info.target_y - pad).max(0.0);
        let crop_w = (zoom_info.target_w + pad * 2.0).min(vw - crop_x);
        let crop_h = (zoom_info.target_h + pad * 2.0).min(vh - crop_y);
    }
}

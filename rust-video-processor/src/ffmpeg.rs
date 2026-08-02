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
    pub fn new(zoom_info: &ZoomInfo, start_ms: u64, viewport: &Viewport) -> Self {
        let vw = viewport.width as f64;
        let vh = viewport.height as f64;
        let pad = zoom_info.padding.unwrap_or(0.0);

        let crop_x = (zoom_info.target_x - pad).max(0.0);
        let crop_y = (zoom_info.target_y - pad).max(0.0);
        let crop_w = (zoom_info.target_w + pad * 2.0).min(vw - crop_x);
        let crop_h = (zoom_info.target_h + pad * 2.0).min(vh - crop_y);

        Self {
            start_ms,
            end_ms: start_ms + zoom_info.duration_ms,
            crop_x,
            crop_y,
            crop_w,
            crop_h,
        }
    }

    pub fn collect_segments(job: &VideoProcessingJob) -> Vec<ZoomSegment> {
        job.steps
            .iter()
            .filter_map(|step| {
                step.zoom
                    .as_ref()
                    .map(|zoom_info| ZoomSegment::new(zoom_info, step.timestamp_ms, &job.viewport))
            })
            .collect()
    }
}

/// Builds the ffmpeg CLI args to encode `job.input_video` into `job.output_video`,
/// applying a crop+scale "zoom" effect during each segment's [start_ms, end_ms) window.
pub fn build_ffmpeg_args(job: &VideoProcessingJob, segments: &[ZoomSegment]) -> Vec<String> {
    let vw = job.viewport.width as f64;
    let vh = job.viewport.height as f64;

    let mut args = vec![
        "-y".to_string(),
        "-i".to_string(),
        job.input_video.clone(),
    ];

    if !segments.is_empty() {
        args.push("-vf".to_string());
        args.push(build_filter_complex(segments, vw, vh));
    }

    args.push("-c:v".to_string());
    args.push("libx264".to_string());
    args.push("-pix_fmt".to_string());
    args.push("yuv420p".to_string());
    args.push(job.output_video.clone());

    args
}

/// Builds a single crop+scale filter whose crop rect is driven by a time-varying
/// expression: inside a segment's window it crops to that segment's rect, otherwise
/// it's the full frame. Scaling back to the viewport size after cropping is what
/// produces the "zoom in" effect.
fn build_filter_complex(segments: &[ZoomSegment], vw: f64, vh: f64) -> String {
    let x_expr = build_time_expr(segments, |s| s.crop_x, 0.0);
    let y_expr = build_time_expr(segments, |s| s.crop_y, 0.0);
    let w_expr = build_time_expr(segments, |s| s.crop_w, vw);
    let h_expr = build_time_expr(segments, |s| s.crop_h, vh);

    format!(
        "crop=w='{w_expr}':h='{h_expr}':x='{x_expr}':y='{y_expr}',scale={vw}:{vh}",
        vw = vw as i64,
        vh = vh as i64,
    )
}

/// Folds segments (rightmost first) into a nested expression, so overlapping
/// evaluation order doesn't matter as long as segments don't overlap in time.
/// Each segment contributes a 3-phase ease-in / hold / ease-out sub-expression
/// that lerps between `default` (full frame) and that segment's target value.
fn build_time_expr(
    segments: &[ZoomSegment],
    value_of: impl Fn(&ZoomSegment) -> f64,
    default: f64,
) -> String {
    segments
        .iter()
        .rev()
        .fold(fmt_num(default), |else_branch, seg| {
            segment_expr(seg, &value_of, default, else_branch)
        })
}

/// Ease duration is 25% of the segment's length on each side, capped at 0.5s
/// and at half the segment's length (so ease-in/ease-out never overlap).
fn ease_seconds(dur_s: f64) -> f64 {
    (dur_s * 0.25).min(0.5).min(dur_s / 2.0).max(0.001)
}

fn segment_expr(
    seg: &ZoomSegment,
    value_of: &impl Fn(&ZoomSegment) -> f64,
    default: f64,
    else_branch: String,
) -> String {
    let start_s = seg.start_ms as f64 / 1000.0;
    let end_s = seg.end_ms as f64 / 1000.0;
    let dur_s = end_s - start_s;
    if dur_s <= 0.0 {
        return else_branch;
    }

    let ease = ease_seconds(dur_s);
    let hold_start = start_s + ease;
    let hold_end = end_s - ease;
    let target = value_of(seg);

    let ease_in_p = smoothstep(&format!("((t-{start_s})/{ease})"));
    let ease_in_val = lerp(default, target, &ease_in_p);

    let ease_out_p = smoothstep(&format!("(({end_s}-t)/{ease})"));
    let ease_out_val = lerp(default, target, &ease_out_p);

    format!(
        "if(between(t,{start_s},{hold_start}),{ease_in_val},\
         if(between(t,{hold_start},{hold_end}),{target},\
         if(between(t,{hold_end},{end_s}),{ease_out_val},{else_branch})))",
        target = fmt_num(target),
    )
}

/// Smoothstep easing: maps a linear progress ratio in [0,1] to an S-curve,
/// so the zoom accelerates in and decelerates out instead of moving at a
/// constant rate.
fn smoothstep(p_expr: &str) -> String {
    format!("(({p})*({p})*(3-2*({p})))", p = p_expr)
}

fn lerp(a: f64, b: f64, p_expr: &str) -> String {
    format!("({a}+({b}-{a})*({p}))", a = fmt_num(a), b = fmt_num(b), p = p_expr)
}

fn fmt_num(v: f64) -> String {
    format!("{v}")
}

mod types;
use anyhow::{Context, Result};
use std::fs;
use types::VideoProcessingJob;

fn main() -> Result<()> {
    let json = fs::read_to_string("test-job.json").context("Could not read test-job.json")?;

    let job: VideoProcessingJob = serde_json::from_str(&json).context("Failed to parse JSON")?;

    println!("Parsed job: {} steps", job.steps.len());
    for step in &job.steps {
        let has_zoom = step.zoom.is_some();
        println!(
            "  Step {}: {} [zoom={}]",
            step.step_index, step.description, has_zoom
        );
    }
    Ok(())
}

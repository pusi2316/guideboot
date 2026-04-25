mod ffmpeg;
mod types;

use std::fs;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};

use anyhow::{Context, Result};
use clap::Parser;
use types::VideoProcessingJob;

#[derive(Parser, Debug)]
#[command(name = "video-processor")]
struct Cli {
    /// Path to video-job.json
    #[arg(long)]
    job: String,
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    let json =
        fs::read_to_string(&cli.job).with_context(|| format!("Could not read: {}", cli.job))?;

    let job: VideoProcessingJob =
        serde_json::from_str(&json).context("Failed to parse video-job.json")?;

    println!("✅ {} steps loaded", job.steps.len());
    for step in &job.steps {
        println!(
            "  Step {}: {} [zoom={}]",
            step.step_index,
            step.description,
            step.zoom.is_some()
        );
    }

    let segments = ffmpeg::ZoomSegment::collect_segments(&job);
    println!("\n✅ {} zoom segments identified\n", segments.len());

    // Test ffmpeg is reachable
    println!("\nChecking ffmpeg...");
    run_ffmpeg(&["-version".to_string()])?;

    Ok(())
}

fn run_ffmpeg(args: &[String]) -> Result<()> {
    let mut child = Command::new("ffmpeg")
        .args(args)
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .context("Failed to spawn ffmpeg — is it installed?")?;

    let stderr = child.stderr.take().unwrap();
    let reader = BufReader::new(stderr);

    for line in reader.lines() {
        let line = line?;
        if line.starts_with("frame=") {
            print!("[progress] {}\r", line.trim());
        }
    }

    let status = child.wait()?;
    anyhow::ensure!(status.success(), "ffmpeg failed: {status}");
    Ok(())
}

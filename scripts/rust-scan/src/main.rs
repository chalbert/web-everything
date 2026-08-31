//! we-scan — Rust ports of check:standards's per-file, CPU-bound scanners (#3417), invoked by
//! `scripts/check-standards.mjs` as a subprocess. Each subcommand prints one JSON array on stdout, the same
//! shape its JS predecessor returned, so the Node caller can swap the source without changing its consumer.
//!
//! Concurrency is a sized `rayon` thread pool (`--max-workers`, or the `WE_SCAN_MAX_WORKERS` env var when
//! the flag is omitted) — the control an external operation manager needs to cap CPU usage across many
//! concurrent lane clones (#3417's Why). The env-var fallback exists so that manager can set the cap for a
//! whole lane's environment without every call site needing to pass a flag.
//!
//! DEFAULT IS A FIXED CAP, NOT "ALL CORES" — a deliberate stopgap (operator call, 2026-08-31) until the
//! operation manager exists to set this per-run. Defaulting to every core would recreate the exact
//! oversubscription problem #3417 exists to fix the moment two or more lanes happen to verify concurrently;
//! defaulting to 1 would forfeit the whole point of this item. `DEFAULT_MAX_WORKERS` picks a small, fixed
//! middle ground: a real fraction of the measured parallel speedup on a solo run, while bounding the
//! worst-case aggregate core usage if several lanes overlap before the manager can arbitrate it. Pass
//! `--max-workers=0` to explicitly opt into "every core" (e.g. a human running this by hand, solo).
const DEFAULT_MAX_WORKERS: usize = 3;

use clap::{Parser, Subcommand};
use rayon::ThreadPoolBuilder;
use std::path::PathBuf;

mod secret_scrub;
mod stdout_flush;

#[derive(Parser)]
#[command(name = "we-scan")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Port of scripts/lib/stdout-flush-scan.mjs's scanStdoutFlush.
    StdoutFlush {
        #[arg(long)]
        root: PathBuf,
        #[arg(long, value_delimiter = ',', default_value = "scripts,skills-src")]
        dirs: Vec<String>,
        /// Cap on worker threads (0 = every core; unset = DEFAULT_MAX_WORKERS, or WE_SCAN_MAX_WORKERS if set).
        #[arg(long, env = "WE_SCAN_MAX_WORKERS", default_value_t = DEFAULT_MAX_WORKERS)]
        max_workers: usize,
    },
    /// Port of scripts/lib/secret-scrub.mjs's scanPublishSecrets (the scrubPublish half only — see the
    /// module doc for why the wider append-seam detector is out of scope).
    SecretScrub {
        #[arg(long)]
        root: PathBuf,
        #[arg(long, value_delimiter = ',', default_value = "backlog,agent-memory-src")]
        labels: Vec<String>,
        #[arg(long, env = "WE_SCAN_MAX_WORKERS", default_value_t = DEFAULT_MAX_WORKERS)]
        max_workers: usize,
    },
}

fn build_pool(max_workers: usize) -> rayon::ThreadPool {
    let mut builder = ThreadPoolBuilder::new();
    if max_workers > 0 {
        builder = builder.num_threads(max_workers);
    }
    builder.build().expect("thread pool build")
}

fn main() {
    let cli = Cli::parse();
    match cli.command {
        Command::StdoutFlush { root, dirs, max_workers } => {
            let pool = build_pool(max_workers);
            let dir_refs: Vec<&str> = dirs.iter().map(|s| s.as_str()).collect();
            let hits = pool.install(|| stdout_flush::scan_stdout_flush_parallel(&root, &dir_refs));
            println!("{}", serde_json::to_string(&hits).expect("serialize"));
        }
        Command::SecretScrub { root, labels, max_workers } => {
            let pool = build_pool(max_workers);
            let label_refs: Vec<&str> = labels.iter().map(|s| s.as_str()).collect();
            let hits = pool.install(|| secret_scrub::scan_publish_secrets_parallel(&root, &label_refs));
            println!("{}", serde_json::to_string(&hits).expect("serialize"));
        }
    }
}

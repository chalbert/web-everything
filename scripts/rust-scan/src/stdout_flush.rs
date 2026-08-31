//! Rust port of `scripts/lib/stdout-flush-scan.mjs` (#3417). Ported AFTER the O(n²)/whitespace-bridging
//! fixes landed (#x4a2488, PR #1730) — this mirrors the CORRECTED JS semantics, not the original.
//!
//! `\w` in every ported pattern is spelled out explicitly as `[A-Za-z0-9_]` (JS's `\w` is always ASCII-only
//! without the `u` flag, which none of the ported patterns use) rather than via `RegexBuilder::unicode(false)`
//! — that flag switches the WHOLE pattern to byte-oriented matching, which the `regex` crate then refuses to
//! build for a `Regex` (str-based) whenever a negated class like `[^"\\]` could match invalid UTF-8. Spelling
//! `\w` out keeps every other class (`\s`, negated literal classes) in default, UTF-8-safe Unicode mode.

use rayon::prelude::*;
use regex::Regex;
use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::Path;

pub const WINDOW: usize = 10;

// `target` (#3417) — kept in parity with `stdout-flush-scan.mjs`'s SKIP_DIRS; see its comment for why.
fn skip_dirs() -> HashSet<&'static str> {
    ["node_modules", ".git", "dist", "_site", "coverage", "__tests__", "target"].into_iter().collect()
}

struct Patterns {
    raw_write: Regex,
    literal_arg: Regex,
    log_json: Regex,
    exit: Regex,
    exit_wraps_call: Regex,
    decl: Regex,
    keywords: HashSet<&'static str>,
}

fn patterns() -> Patterns {
    Patterns {
        raw_write: Regex::new(r"process\.stdout\.write\s*\(").unwrap(),
        literal_arg: Regex::new(r#"process\.stdout\.write\s*\(\s*(?:'[^'\\]*'|"[^"\\]*"|`[^`$\\]*`)\s*\)"#).unwrap(),
        log_json: Regex::new(r"console\.log\s*\([^)]*JSON\.stringify").unwrap(),
        exit: Regex::new(r"process\.exit\s*\(").unwrap(),
        exit_wraps_call: Regex::new(r"process\.exit\s*\(\s*[A-Za-z_$][A-Za-z0-9_$]*\s*\(").unwrap(),
        decl: Regex::new(
            r"(?:^|[^.A-Za-z0-9_$])(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(|(?:^|[^.A-Za-z0-9_$])(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)\s*=>|function\b)",
        )
        .unwrap(),
        keywords: [
            "return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "case", "do", "else",
            "yield", "await",
        ]
        .into_iter()
        .collect(),
    }
}

fn is_word_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || c == '_' || c == '$'
}
fn is_ws_char(c: char) -> bool {
    c.is_whitespace()
}

/// The incremental tail-state tracker (#x4a2488/#1730's fixed shape): `lastChar` (last NON-WHITESPACE
/// appended char) and `lastWordTail` (contiguous `[\w$]` run ending there) decide regex-vs-division;
/// `prev_appended_was_word` — updated on EVERY append, including whitespace — is what makes a *new* word char
/// correctly fail to bridge across whitespace onto an earlier, unrelated word (the exact bug the JS review
/// caught: `x in` must read tail `"in"`, never `"xin"`).
struct RegexTailTracker {
    last_char: Option<char>,
    last_word_tail: String,
    prev_appended_was_word: bool,
}

impl RegexTailTracker {
    fn new() -> Self {
        Self { last_char: None, last_word_tail: String::new(), prev_appended_was_word: false }
    }

    fn note(&mut self, c: char) {
        let is_word = is_word_char(c);
        if is_word {
            if self.prev_appended_was_word {
                self.last_word_tail.push(c);
            } else {
                self.last_word_tail.clear();
                self.last_word_tail.push(c);
            }
            self.last_char = Some(c);
        } else if !is_ws_char(c) {
            self.last_word_tail.clear();
            self.last_char = Some(c);
        }
        self.prev_appended_was_word = is_word;
    }

    fn starts_regex(&self, keywords: &HashSet<&'static str>) -> bool {
        match self.last_char {
            None => true,
            Some(c) if matches!(c, ')' | ']' | '\'' | '"' | '`') => false,
            Some(c) if is_word_char(c) => keywords.contains(self.last_word_tail.as_str()),
            _ => true,
        }
    }
}

/// Blank comments and the CONTENTS of every string/template/regex literal, preserving line count and every
/// brace that is real code. One-to-one port of `stripLiterals` — see its JS doc for the template-hole and
/// regex-vs-division rationale this mirrors exactly.
fn strip_literals(src: &str) -> Vec<String> {
    let p = patterns();
    let chars: Vec<char> = src.chars().collect();
    let n = chars.len();
    let mut out = String::with_capacity(src.len());
    let mut tracker = RegexTailTracker::new();

    #[derive(Clone)]
    enum Frame {
        Tpl,
        Hole(u32),
    }
    let mut stack: Vec<Frame> = Vec::new();
    let mut i = 0usize;

    let keep = |out: &mut String, tracker: &mut RegexTailTracker, c: char| {
        out.push(c);
        tracker.note(c);
    };
    let blank = |out: &mut String, tracker: &mut RegexTailTracker, c: char| {
        let b = if c == '\n' { '\n' } else { ' ' };
        out.push(b);
        tracker.note(b);
    };

    while i < n {
        let c = chars[i];
        let c2 = if i + 1 < n { Some(chars[i + 1]) } else { None };

        let in_template_text = matches!(stack.last(), Some(Frame::Tpl));
        if in_template_text {
            if c == '`' {
                stack.pop();
                keep(&mut out, &mut tracker, c);
                i += 1;
                continue;
            }
            if c == '$' && c2 == Some('{') {
                stack.push(Frame::Hole(0));
                keep(&mut out, &mut tracker, chars[i]);
                i += 1;
                keep(&mut out, &mut tracker, chars[i]);
                i += 1;
                continue;
            }
            if c == '\\' {
                blank(&mut out, &mut tracker, chars[i]);
                i += 1;
                if i < n {
                    blank(&mut out, &mut tracker, chars[i]);
                    i += 1;
                }
                continue;
            }
            blank(&mut out, &mut tracker, chars[i]);
            i += 1;
            continue;
        }

        // ── code context ──
        if c == '/' && c2 == Some('/') {
            while i < n && chars[i] != '\n' {
                blank(&mut out, &mut tracker, chars[i]);
                i += 1;
            }
            continue;
        }
        if c == '/' && c2 == Some('*') {
            blank(&mut out, &mut tracker, chars[i]);
            i += 1;
            blank(&mut out, &mut tracker, chars[i]);
            i += 1;
            while i < n && !(chars[i] == '*' && i + 1 < n && chars[i + 1] == '/') {
                blank(&mut out, &mut tracker, chars[i]);
                i += 1;
            }
            if i < n {
                blank(&mut out, &mut tracker, chars[i]);
                i += 1;
                blank(&mut out, &mut tracker, chars[i]);
                i += 1;
            }
            continue;
        }
        if c == '\'' || c == '"' {
            keep(&mut out, &mut tracker, c);
            i += 1;
            while i < n && chars[i] != c {
                if chars[i] == '\\' {
                    blank(&mut out, &mut tracker, chars[i]);
                    i += 1;
                }
                if i < n {
                    blank(&mut out, &mut tracker, chars[i]);
                    i += 1;
                }
            }
            if i < n {
                keep(&mut out, &mut tracker, chars[i]);
                i += 1;
            }
            continue;
        }
        if c == '/' && tracker.starts_regex(&p.keywords) {
            keep(&mut out, &mut tracker, c);
            i += 1;
            let mut in_class = false;
            while i < n {
                let d = chars[i];
                if d == '\\' {
                    blank(&mut out, &mut tracker, chars[i]);
                    i += 1;
                    if i < n {
                        blank(&mut out, &mut tracker, chars[i]);
                        i += 1;
                    }
                    continue;
                }
                if d == '\n' {
                    break;
                }
                if d == '[' {
                    in_class = true;
                } else if d == ']' {
                    in_class = false;
                } else if d == '/' && !in_class {
                    keep(&mut out, &mut tracker, chars[i]);
                    i += 1;
                    break;
                }
                blank(&mut out, &mut tracker, chars[i]);
                i += 1;
            }
            continue;
        }
        if c == '`' {
            stack.push(Frame::Tpl);
            keep(&mut out, &mut tracker, c);
            i += 1;
            continue;
        }
        if let Some(Frame::Hole(depth)) = stack.last_mut() {
            if c == '{' {
                *depth += 1;
                keep(&mut out, &mut tracker, c);
                i += 1;
                continue;
            }
            if c == '}' {
                if *depth > 0 {
                    *depth -= 1;
                    keep(&mut out, &mut tracker, c);
                    i += 1;
                    continue;
                }
                stack.pop();
                keep(&mut out, &mut tracker, c);
                i += 1;
                continue;
            }
        }
        keep(&mut out, &mut tracker, c);
        i += 1;
    }
    out.split('\n').map(|s| s.to_string()).collect()
}

struct FunctionExtent {
    name: String,
    start: usize,
    end: usize,
}

/// Port of `functionExtents`. Innermost-last (matches JS: findings are pushed in declaration order, and the
/// caller's `enclosing()` picks the one with the LARGEST `start` among those containing a line).
fn function_extents(lines: &[String]) -> Vec<FunctionExtent> {
    let p = patterns();
    let mut extents = Vec::new();
    for i in 0..lines.len() {
        let line = &lines[i];
        let m = match p.decl.captures(line) {
            Some(m) => m,
            None => continue,
        };
        let whole = m.get(0).unwrap();
        let name = m.get(1).or_else(|| m.get(2)).unwrap().as_str().to_string();
        let decl_start_col = whole.start();

        let mut seen = false;
        let mut end: Option<usize> = None;
        'find_open: for j in i..lines.len() {
            let text: &str = if j == i { &line[decl_start_col..] } else { &lines[j] };
            for ch in text.chars() {
                if ch == '{' {
                    seen = true;
                    break 'find_open;
                }
                if ch == ';' {
                    break 'find_open;
                }
            }
        }
        if !seen {
            continue;
        }

        let mut depth: i64 = 0;
        seen = false;
        for j in i..lines.len() {
            let text: &str = if j == i { &line[decl_start_col..] } else { &lines[j] };
            for ch in text.chars() {
                if ch == '{' {
                    depth += 1;
                    seen = true;
                } else if ch == '}' {
                    depth -= 1;
                }
            }
            if seen && depth <= 0 {
                end = Some(j);
                break;
            }
        }
        if let Some(end) = end {
            extents.push(FunctionExtent { name, start: i, end });
        }
    }
    extents
}

fn exiting_function_names(lines: &[String], extents: &[FunctionExtent]) -> HashSet<String> {
    let p = patterns();
    let mut names = HashSet::new();
    for ex in extents {
        for i in ex.start..=ex.end {
            if p.exit.is_match(&lines[i]) {
                names.insert(ex.name.clone());
                break;
            }
        }
    }
    names
}

#[derive(Serialize)]
pub struct Violation {
    pub line: usize,
    pub kind: String,
    pub text: String,
}

fn enclosing<'a>(extents: &'a [FunctionExtent], i: usize) -> Option<&'a FunctionExtent> {
    let mut best: Option<&FunctionExtent> = None;
    for ex in extents {
        if ex.start <= i && i <= ex.end {
            if best.is_none_or(|b| ex.start > b.start) {
                best = Some(ex);
            }
        }
    }
    best
}

fn escape_regex_alt(names: &[&str]) -> String {
    names
        .iter()
        .map(|n| regex::escape(n))
        .collect::<Vec<_>>()
        .join("|")
}

pub fn find_stdout_flush_violations(src: &str) -> Vec<Violation> {
    let p = patterns();
    let lines = strip_literals(src);
    let raw: Vec<&str> = src.split('\n').collect();
    let extents = function_extents(&lines);
    let exit_fns = exiting_function_names(&lines, &extents);
    let mut out = Vec::new();

    for i in 0..lines.len() {
        let l = &lines[i];

        if p.exit_wraps_call.is_match(l) {
            let text: String = raw.get(i).unwrap_or(&"").trim().chars().take(120).collect();
            out.push(Violation { line: i + 1, kind: "exit-wraps-call".to_string(), text });
            continue;
        }

        let unbounded = (p.raw_write.is_match(l) && !p.literal_arg.is_match(l)) || p.log_json.is_match(l);
        if !unbounded {
            continue;
        }

        let fn_here = enclosing(&extents, i);
        let callable: Vec<&str> = exit_fns
            .iter()
            .filter(|nm| fn_here.map(|f| f.name.as_str()) != Some(nm.as_str()))
            .map(|s| s.as_str())
            .collect();
        let exit_fn_call = if callable.is_empty() {
            None
        } else {
            Some(Regex::new(&format!(r"\b(?:{})\s*\(", escape_regex_alt(&callable))).unwrap())
        };
        let last = fn_here.map(|f| f.end).unwrap_or(lines.len() - 1).min(i + WINDOW);

        for j in i..=last {
            if p.exit.is_match(&lines[j]) {
                let text: String = raw.get(i).unwrap_or(&"").trim().chars().take(120).collect();
                out.push(Violation { line: i + 1, kind: "emit-then-exit".to_string(), text });
                break;
            }
            if let Some(re) = &exit_fn_call {
                if re.is_match(&lines[j]) {
                    let text: String = raw.get(i).unwrap_or(&"").trim().chars().take(120).collect();
                    out.push(Violation { line: i + 1, kind: "emit-then-exit-fn".to_string(), text });
                    break;
                }
            }
        }
    }
    out
}

#[derive(Serialize)]
pub struct FileViolation {
    pub file: String,
    pub line: usize,
    pub kind: String,
    pub text: String,
}

fn list_source_files(root: &Path, dirs: &[&str]) -> Vec<std::path::PathBuf> {
    let skip = skip_dirs();
    let mut files: Vec<std::path::PathBuf> = Vec::new();

    fn walk(dir: &Path, skip: &HashSet<&'static str>, files: &mut Vec<std::path::PathBuf>) {
        let entries = match fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return,
        };
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if skip.contains(name.as_str()) {
                continue;
            }
            let path = entry.path();
            if path.is_dir() {
                walk(&path, skip, files);
            } else if name.ends_with(".mjs") || name.ends_with(".js") {
                files.push(path);
            }
        }
    }

    for d in dirs {
        let abs = root.join(d);
        if abs.is_dir() {
            walk(&abs, &skip, &mut files);
        }
    }
    files.sort();
    files
}

fn scan_one_file(root: &Path, f: &Path) -> Vec<FileViolation> {
    let content = match fs::read_to_string(f) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    let rel = f.strip_prefix(root).unwrap_or(f).to_string_lossy().replace('\\', "/");
    find_stdout_flush_violations(&content)
        .into_iter()
        .map(|v| FileViolation { file: rel.clone(), line: v.line, kind: v.kind, text: v.text })
        .collect()
}

/// Sequential reference implementation — kept for the differential test against the JS port and for a
/// `--max-workers=1` caller that wants to skip rayon's pool setup entirely. Unused outside `#[cfg(test)]` in
/// the CLI binary today, hence the lint suppression — not dead in the sense the lint means.
#[allow(dead_code)]
pub fn scan_stdout_flush(root: &Path, dirs: &[&str]) -> Vec<FileViolation> {
    let files = list_source_files(root, dirs);
    let mut hits = Vec::new();
    for f in &files {
        for v in scan_one_file(root, f) {
            hits.push(v);
        }
    }
    hits
}

/// The `rayon`-parallel entry point the CLI calls (#3417) — same file list and per-file logic as
/// `scan_stdout_flush`, fanned out across whatever pool the caller installed (`ThreadPool::install`), then
/// re-flattened in the ORIGINAL sorted-file order so output stays deterministic and byte-diffable against the
/// sequential/JS reference regardless of which worker finished first.
pub fn scan_stdout_flush_parallel(root: &Path, dirs: &[&str]) -> Vec<FileViolation> {
    let files = list_source_files(root, dirs);
    files.par_iter().map(|f| scan_one_file(root, f)).collect::<Vec<_>>().into_iter().flatten().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn violations(src: &str) -> Vec<(usize, String)> {
        find_stdout_flush_violations(src).into_iter().map(|v| (v.line, v.kind)).collect()
    }

    #[test]
    fn emit_then_exit_json_stringify() {
        let src = "function main() {\n  process.stdout.write(JSON.stringify({ ok: true }));\n  process.exit(0);\n}\nmain();\n";
        assert_eq!(violations(src), vec![(2, "emit-then-exit".to_string())]);
    }

    #[test]
    fn emit_then_exit_via_local_helper() {
        let src = "function fail(msg) {\n  process.stdout.write(msg + '\\n');\n  process.exit(2);\n}\nfunction run() {\n  if (bad) fail('nope');\n  process.stdout.write('ok\\n');\n}\nrun();\n";
        // Only fail()'s own write+exit fires; run()'s write is not followed by a call to fail().
        assert_eq!(violations(src), vec![(2, "emit-then-exit".to_string())]);
    }

    #[test]
    fn exit_wraps_call() {
        let src = "function main(argv) {\n  process.stdout.write(JSON.stringify(argv));\n  return 0;\n}\nprocess.exit(main(process.argv));\n";
        assert_eq!(violations(src), vec![(5, "exit-wraps-call".to_string())]);
    }

    #[test]
    fn literal_write_never_flagged() {
        let src = "process.stdout.write('static banner\\n');\nprocess.exit(0);\n";
        assert_eq!(violations(src), vec![]);
    }

    #[test]
    fn keyword_preceded_by_identifier_across_whitespace_regression() {
        // The #1730 review finding: `x in` must not bridge into a false "xin" word tail, or the following
        // `/…/` is misread as division and the unescaped quote inside desyncs the scanner.
        let src = "function f(x){ if (x in/[&<>\"']/.test(x)) return; process.stdout.write(JSON.stringify(x)); process.exit(0); }\n";
        assert_eq!(violations(src), vec![(1, "emit-then-exit".to_string())]);
    }

    #[test]
    fn regex_literal_with_unpaired_quotes_does_not_desync() {
        let src = "const esc = (s) => String(s).replace(/[&<>\"']/g, (c) => c);\nfunction g(x) {\n  const msg = `${JSON.stringify({ error: x })}`;\n  process.stdout.write(msg);\n  process.exit(1);\n}\n";
        assert_eq!(violations(src), vec![(4, "emit-then-exit".to_string())]);
    }

    #[test]
    fn tests_dir_is_skipped_by_the_walk() {
        let dir = std::env::temp_dir().join(format!("we-scan-test-{}", std::process::id()));
        let tests_dir = dir.join("scripts").join("__tests__");
        fs::create_dir_all(&tests_dir).unwrap();
        fs::write(tests_dir.join("skip-me.mjs"), "process.stdout.write(JSON.stringify({}));\nprocess.exit(0);\n").unwrap();
        let hits = scan_stdout_flush(&dir, &["scripts"]);
        fs::remove_dir_all(&dir).ok();
        assert_eq!(hits.len(), 0);
    }

    #[test]
    fn sequential_and_parallel_scans_agree_on_a_real_multi_file_tree() {
        let dir = std::env::temp_dir().join(format!("we-scan-test-parity-{}", std::process::id()));
        let scripts = dir.join("scripts");
        fs::create_dir_all(&scripts).unwrap();
        fs::write(scripts.join("a.mjs"), "function main() {\n  process.stdout.write(JSON.stringify({}));\n  process.exit(0);\n}\n").unwrap();
        fs::write(scripts.join("b.mjs"), "process.stdout.write('lit\\n');\nprocess.exit(0);\n").unwrap();
        fs::write(scripts.join("c.mjs"), "process.exit(main(process.argv));\n").unwrap();

        let seq = scan_stdout_flush(&dir, &["scripts"]);
        let par = scan_stdout_flush_parallel(&dir, &["scripts"]);
        fs::remove_dir_all(&dir).ok();

        let norm = |v: Vec<FileViolation>| -> Vec<String> {
            let mut s: Vec<String> = v.into_iter().map(|h| format!("{}:{}:{}", h.file, h.line, h.kind)).collect();
            s.sort();
            s
        };
        assert_eq!(norm(seq), norm(par));
    }
}

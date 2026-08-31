//! Lightweight backlog frontmatter extraction for citation_check.rs — NOT a general YAML parser. Only the
//! three scalar fields the citation gates need (`codifiedIn`, `graduatedTo`, `bornAs`) plus the item's `num`
//! (derived from the filename, matching `src/_data/backlog.js`'s own `ID_TOKEN` convention — a leading
//! `\d{1,5}` (landed) or `x[0-9a-z]{6}` (in-flight, JIT-numbering) token before the first `-`), so this port
//! stays self-contained (its own file walk, no data passed in from the JS backlog loader) like every other
//! we-scan subcommand. Verified against the real corpus's actual field shapes before writing this (all
//! observed `codifiedIn`/`bornAs` values are single-line scalars, quoted or bare) — this is NOT a defensive
//! guess, the shapes were checked.

use regex::Regex;
use std::fs;
use std::path::Path;
use std::sync::OnceLock;

pub struct BacklogItem {
    pub num: String,
    pub codified_in: Option<String>,
    pub graduated_to: Option<String>,
    pub born_as: Option<String>,
}

fn id_token_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"^([0-9]{1,5}|x[0-9a-z]{6})-").unwrap())
}

fn hash_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"^x[0-9a-z]{6}$").unwrap())
}

pub fn is_hash(s: &str) -> bool {
    hash_re().is_match(s)
}

fn field_re(name: &str) -> Regex {
    // `key: "quoted value"` or `key: bare value` — a single-line scalar, optionally double-quoted. The
    // corpus's actual fields are never single-quoted or multi-line for these three keys.
    Regex::new(&format!(r#"(?m)^{name}:\s*"?([^"\r\n]*?)"?\s*$"#)).unwrap()
}

/// Parse ONE backlog file's frontmatter block (between the leading `---` delimiters) for the three fields
/// citation-check needs. Returns `None` only when the filename doesn't carry a valid `num` token — a
/// malformed/foreign file, which the caller should just skip (matching the JS loader's "skip malformed,
/// warn elsewhere" posture — this port doesn't re-implement THAT warning, only the citation gates).
pub fn parse_backlog_item(filename: &str, content: &str) -> Option<BacklogItem> {
    let caps = id_token_re().captures(filename)?;
    let num = caps.get(1)?.as_str().to_string();

    // Frontmatter is the text between the first two `---` lines (a YAML block at the very top of the file).
    let fm = extract_frontmatter(content).unwrap_or("");
    let get = |name: &str| -> Option<String> {
        let re = field_re(name);
        let v = re.captures(fm)?.get(1)?.as_str().trim().to_string();
        if v.is_empty() { None } else { Some(v) }
    };

    Some(BacklogItem {
        num,
        codified_in: get("codifiedIn"),
        graduated_to: get("graduatedTo"),
        born_as: get("bornAs"),
    })
}

fn extract_frontmatter(content: &str) -> Option<&str> {
    let rest = content.strip_prefix("---\n")?;
    let end = rest.find("\n---")?;
    Some(&rest[..end])
}

fn list_backlog_files(root: &Path) -> Vec<(String, std::path::PathBuf)> {
    let dir = root.join("backlog");
    let entries = match fs::read_dir(&dir) {
        Ok(e) => e,
        Err(_) => return Vec::new(),
    };
    let mut names: Vec<String> = entries
        .flatten()
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            if name.ends_with(".md") { Some(name) } else { None }
        })
        .collect();
    names.sort();
    names.into_iter().map(|n| (n.clone(), dir.join(n))).collect()
}

/// Walk `backlog/*.md` and parse every item's citation-relevant fields. Mirrors `check-standards.mjs`'s
/// already-loaded `backlog` array's `num`/`codifiedIn`/`graduatedTo`/`bornAs` — this is the ONE piece of
/// this port that re-derives (a narrow slice of) what the JS backlog loader already computed, rather than
/// walking a directory of independent source files; see the module doc for why that's the right call here.
pub fn load_backlog_items(root: &Path) -> Vec<BacklogItem> {
    list_backlog_files(root)
        .into_iter()
        .filter_map(|(name, path)| {
            let content = fs::read_to_string(&path).ok()?;
            parse_backlog_item(&name, &content)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_numeric_landed_item() {
        let item = parse_backlog_item(
            "042-some-slug.md",
            "---\nkind: story\ncodifiedIn: \"docs/agent/platform-decisions.md#foo\"\nbornAs: xabc123\n---\nbody\n",
        )
        .unwrap();
        assert_eq!(item.num, "042");
        assert_eq!(item.codified_in.as_deref(), Some("docs/agent/platform-decisions.md#foo"));
        assert_eq!(item.born_as.as_deref(), Some("xabc123"));
        assert_eq!(item.graduated_to, None);
    }

    #[test]
    fn parses_hash_pending_item() {
        let item = parse_backlog_item("x9kptqv-some-slug.md", "---\nkind: story\n---\nbody\n").unwrap();
        assert_eq!(item.num, "x9kptqv");
    }

    #[test]
    fn unquoted_scalar_values_parse() {
        let item = parse_backlog_item("001-a.md", "---\ngraduatedTo: none\n---\n").unwrap();
        assert_eq!(item.graduated_to.as_deref(), Some("none"));
    }

    #[test]
    fn malformed_filename_returns_none() {
        assert!(parse_backlog_item("not-a-valid-id.md", "---\n---\n").is_none());
    }

    #[test]
    fn is_hash_matches_exactly_the_shape() {
        assert!(is_hash("x9kptqv"));
        assert!(!is_hash("cvg2563r")); // 8 chars, doesn't start with x — a real corpus example, not fictional
        assert!(!is_hash("042"));
    }
}

//! Literal, non-cascading final-output processing and opt-in in-memory recovery.
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

pub const MAX_RULE_BYTES: usize = 32 * 1024;
pub const MAX_RULES: usize = 256;
pub const MAX_TEXT_BYTES: usize = 1024 * 1024;
const MAX_RESULTS: usize = 10;

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
enum MatchMode {
    Legacy,
    Exact,
    Word,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct RuleInput {
    source: String,
    replacement: String,
    language: String,
    match_mode: MatchMode,
    ignore_case: bool,
}

#[derive(Debug)]
pub struct Rule {
    source: String,
    replacement: String,
    language: String,
    match_mode: MatchMode,
    ignore_case: bool,
    lowercase_source: String,
}

pub fn supported_language(language: &str) -> bool {
    matches!(
        language,
        "zh" | "en"
            | "ja"
            | "ko"
            | "de"
            | "fr"
            | "es"
            | "ru"
            | "pt"
            | "it"
            | "nl"
            | "pl"
            | "tr"
            | "ar"
            | "hi"
            | "id"
            | "ms"
            | "th"
            | "vi"
            | "uk"
            | "fa"
            | "he"
            | "el"
            | "sv"
            | "da"
            | "fi"
            | "hu"
            | "ro"
            | "cs"
            | "bg"
            | "ca"
            | "bn"
            | "ta"
            | "no"
    )
}

pub fn parse_rules(text: &str) -> Result<Vec<Rule>, String> {
    if text.len() > MAX_RULE_BYTES {
        return Err(format!("纠错词典不能超过 {MAX_RULE_BYTES} 字节"));
    }
    let trimmed = text.trim_start();
    // Preserve legacy literal sources such as `[newline] => ...`. JSON-shaped
    // input stays strict even if a malformed document happens to contain `=>`.
    let legacy_first_line = trimmed
        .lines()
        .next()
        .and_then(|line| line.split_once("=>"))
        .is_some_and(|(source, _)| {
            let compact: String = source.chars().filter(|ch| !ch.is_whitespace()).collect();
            !["[{", "[\"", "[]", "{\"", "{}"]
                .iter()
                .any(|prefix| compact.starts_with(prefix))
        });
    let inputs: Vec<RuleInput> =
        if (trimmed.starts_with('[') || trimmed.starts_with('{')) && !legacy_first_line {
            serde_json::from_str(text).map_err(|error| format!("纠错词典 JSON 无效：{error}"))?
        } else {
            let mut inputs = Vec::new();
            for (index, line) in text.lines().enumerate() {
                if line.trim().is_empty() {
                    continue;
                }
                let (source, replacement) = line.split_once("=>").ok_or_else(|| {
                    format!("纠错词典第 {} 行需要 source => replacement", index + 1)
                })?;
                inputs.push(RuleInput {
                    source: source.trim().into(),
                    replacement: replacement.trim().into(),
                    language: "*".into(),
                    match_mode: MatchMode::Legacy,
                    ignore_case: false,
                });
            }
            inputs
        };
    if inputs.len() > MAX_RULES {
        return Err(format!("纠错词典不能超过 {MAX_RULES} 条"));
    }
    let mut rules: Vec<Rule> = Vec::with_capacity(inputs.len());
    for (index, input) in inputs.into_iter().enumerate() {
        if input.source.trim().is_empty() {
            return Err(format!("纠错词典第 {} 条的原词不能为空", index + 1));
        }
        if input.language != "*" && !supported_language(&input.language) {
            return Err(format!("纠错词典第 {} 条的语言无效", index + 1));
        }
        // Unicode default lowercase, not full case folding or normalization.
        let lowercase_source: String = input.source.chars().flat_map(char::to_lowercase).collect();
        if rules.iter().any(|rule| {
            rule.language == input.language
                && (rule.source == input.source
                    || ((rule.ignore_case || input.ignore_case)
                        && rule.lowercase_source == lowercase_source))
        }) {
            return Err(format!("纠错词典第 {} 条的原词与同语言规则冲突", index + 1));
        }
        rules.push(Rule {
            source: input.source,
            replacement: input.replacement,
            language: input.language,
            match_mode: input.match_mode,
            ignore_case: input.ignore_case,
            lowercase_source,
        });
    }
    Ok(rules)
}

fn legacy_word_char(ch: char) -> bool {
    ch.is_alphanumeric() || ch == '_'
}

// Unicode 15.0.0 General_Category M (Mn/Mc/Me), generated from Unicode data.
// Binary search avoids a dependency and keeps combining accents part of words.
fn is_combining_mark(ch: char) -> bool {
    const RANGES: &[(u32, u32)] = &[
        (0x300, 0x36F),
        (0x483, 0x489),
        (0x591, 0x5BD),
        (0x5BF, 0x5BF),
        (0x5C1, 0x5C2),
        (0x5C4, 0x5C5),
        (0x5C7, 0x5C7),
        (0x610, 0x61A),
        (0x64B, 0x65F),
        (0x670, 0x670),
        (0x6D6, 0x6DC),
        (0x6DF, 0x6E4),
        (0x6E7, 0x6E8),
        (0x6EA, 0x6ED),
        (0x711, 0x711),
        (0x730, 0x74A),
        (0x7A6, 0x7B0),
        (0x7EB, 0x7F3),
        (0x7FD, 0x7FD),
        (0x816, 0x819),
        (0x81B, 0x823),
        (0x825, 0x827),
        (0x829, 0x82D),
        (0x859, 0x85B),
        (0x898, 0x89F),
        (0x8CA, 0x8E1),
        (0x8E3, 0x903),
        (0x93A, 0x93C),
        (0x93E, 0x94F),
        (0x951, 0x957),
        (0x962, 0x963),
        (0x981, 0x983),
        (0x9BC, 0x9BC),
        (0x9BE, 0x9C4),
        (0x9C7, 0x9C8),
        (0x9CB, 0x9CD),
        (0x9D7, 0x9D7),
        (0x9E2, 0x9E3),
        (0x9FE, 0x9FE),
        (0xA01, 0xA03),
        (0xA3C, 0xA3C),
        (0xA3E, 0xA42),
        (0xA47, 0xA48),
        (0xA4B, 0xA4D),
        (0xA51, 0xA51),
        (0xA70, 0xA71),
        (0xA75, 0xA75),
        (0xA81, 0xA83),
        (0xABC, 0xABC),
        (0xABE, 0xAC5),
        (0xAC7, 0xAC9),
        (0xACB, 0xACD),
        (0xAE2, 0xAE3),
        (0xAFA, 0xAFF),
        (0xB01, 0xB03),
        (0xB3C, 0xB3C),
        (0xB3E, 0xB44),
        (0xB47, 0xB48),
        (0xB4B, 0xB4D),
        (0xB55, 0xB57),
        (0xB62, 0xB63),
        (0xB82, 0xB82),
        (0xBBE, 0xBC2),
        (0xBC6, 0xBC8),
        (0xBCA, 0xBCD),
        (0xBD7, 0xBD7),
        (0xC00, 0xC04),
        (0xC3C, 0xC3C),
        (0xC3E, 0xC44),
        (0xC46, 0xC48),
        (0xC4A, 0xC4D),
        (0xC55, 0xC56),
        (0xC62, 0xC63),
        (0xC81, 0xC83),
        (0xCBC, 0xCBC),
        (0xCBE, 0xCC4),
        (0xCC6, 0xCC8),
        (0xCCA, 0xCCD),
        (0xCD5, 0xCD6),
        (0xCE2, 0xCE3),
        (0xCF3, 0xCF3),
        (0xD00, 0xD03),
        (0xD3B, 0xD3C),
        (0xD3E, 0xD44),
        (0xD46, 0xD48),
        (0xD4A, 0xD4D),
        (0xD57, 0xD57),
        (0xD62, 0xD63),
        (0xD81, 0xD83),
        (0xDCA, 0xDCA),
        (0xDCF, 0xDD4),
        (0xDD6, 0xDD6),
        (0xDD8, 0xDDF),
        (0xDF2, 0xDF3),
        (0xE31, 0xE31),
        (0xE34, 0xE3A),
        (0xE47, 0xE4E),
        (0xEB1, 0xEB1),
        (0xEB4, 0xEBC),
        (0xEC8, 0xECE),
        (0xF18, 0xF19),
        (0xF35, 0xF35),
        (0xF37, 0xF37),
        (0xF39, 0xF39),
        (0xF3E, 0xF3F),
        (0xF71, 0xF84),
        (0xF86, 0xF87),
        (0xF8D, 0xF97),
        (0xF99, 0xFBC),
        (0xFC6, 0xFC6),
        (0x102B, 0x103E),
        (0x1056, 0x1059),
        (0x105E, 0x1060),
        (0x1062, 0x1064),
        (0x1067, 0x106D),
        (0x1071, 0x1074),
        (0x1082, 0x108D),
        (0x108F, 0x108F),
        (0x109A, 0x109D),
        (0x135D, 0x135F),
        (0x1712, 0x1715),
        (0x1732, 0x1734),
        (0x1752, 0x1753),
        (0x1772, 0x1773),
        (0x17B4, 0x17D3),
        (0x17DD, 0x17DD),
        (0x180B, 0x180D),
        (0x180F, 0x180F),
        (0x1885, 0x1886),
        (0x18A9, 0x18A9),
        (0x1920, 0x192B),
        (0x1930, 0x193B),
        (0x1A17, 0x1A1B),
        (0x1A55, 0x1A5E),
        (0x1A60, 0x1A7C),
        (0x1A7F, 0x1A7F),
        (0x1AB0, 0x1ACE),
        (0x1B00, 0x1B04),
        (0x1B34, 0x1B44),
        (0x1B6B, 0x1B73),
        (0x1B80, 0x1B82),
        (0x1BA1, 0x1BAD),
        (0x1BE6, 0x1BF3),
        (0x1C24, 0x1C37),
        (0x1CD0, 0x1CD2),
        (0x1CD4, 0x1CE8),
        (0x1CED, 0x1CED),
        (0x1CF4, 0x1CF4),
        (0x1CF7, 0x1CF9),
        (0x1DC0, 0x1DFF),
        (0x20D0, 0x20F0),
        (0x2CEF, 0x2CF1),
        (0x2D7F, 0x2D7F),
        (0x2DE0, 0x2DFF),
        (0x302A, 0x302F),
        (0x3099, 0x309A),
        (0xA66F, 0xA672),
        (0xA674, 0xA67D),
        (0xA69E, 0xA69F),
        (0xA6F0, 0xA6F1),
        (0xA802, 0xA802),
        (0xA806, 0xA806),
        (0xA80B, 0xA80B),
        (0xA823, 0xA827),
        (0xA82C, 0xA82C),
        (0xA880, 0xA881),
        (0xA8B4, 0xA8C5),
        (0xA8E0, 0xA8F1),
        (0xA8FF, 0xA8FF),
        (0xA926, 0xA92D),
        (0xA947, 0xA953),
        (0xA980, 0xA983),
        (0xA9B3, 0xA9C0),
        (0xA9E5, 0xA9E5),
        (0xAA29, 0xAA36),
        (0xAA43, 0xAA43),
        (0xAA4C, 0xAA4D),
        (0xAA7B, 0xAA7D),
        (0xAAB0, 0xAAB0),
        (0xAAB2, 0xAAB4),
        (0xAAB7, 0xAAB8),
        (0xAABE, 0xAABF),
        (0xAAC1, 0xAAC1),
        (0xAAEB, 0xAAEF),
        (0xAAF5, 0xAAF6),
        (0xABE3, 0xABEA),
        (0xABEC, 0xABED),
        (0xFB1E, 0xFB1E),
        (0xFE00, 0xFE0F),
        (0xFE20, 0xFE2F),
        (0x101FD, 0x101FD),
        (0x102E0, 0x102E0),
        (0x10376, 0x1037A),
        (0x10A01, 0x10A03),
        (0x10A05, 0x10A06),
        (0x10A0C, 0x10A0F),
        (0x10A38, 0x10A3A),
        (0x10A3F, 0x10A3F),
        (0x10AE5, 0x10AE6),
        (0x10D24, 0x10D27),
        (0x10EAB, 0x10EAC),
        (0x10EFD, 0x10EFF),
        (0x10F46, 0x10F50),
        (0x10F82, 0x10F85),
        (0x11000, 0x11002),
        (0x11038, 0x11046),
        (0x11070, 0x11070),
        (0x11073, 0x11074),
        (0x1107F, 0x11082),
        (0x110B0, 0x110BA),
        (0x110C2, 0x110C2),
        (0x11100, 0x11102),
        (0x11127, 0x11134),
        (0x11145, 0x11146),
        (0x11173, 0x11173),
        (0x11180, 0x11182),
        (0x111B3, 0x111C0),
        (0x111C9, 0x111CC),
        (0x111CE, 0x111CF),
        (0x1122C, 0x11237),
        (0x1123E, 0x1123E),
        (0x11241, 0x11241),
        (0x112DF, 0x112EA),
        (0x11300, 0x11303),
        (0x1133B, 0x1133C),
        (0x1133E, 0x11344),
        (0x11347, 0x11348),
        (0x1134B, 0x1134D),
        (0x11357, 0x11357),
        (0x11362, 0x11363),
        (0x11366, 0x1136C),
        (0x11370, 0x11374),
        (0x11435, 0x11446),
        (0x1145E, 0x1145E),
        (0x114B0, 0x114C3),
        (0x115AF, 0x115B5),
        (0x115B8, 0x115C0),
        (0x115DC, 0x115DD),
        (0x11630, 0x11640),
        (0x116AB, 0x116B7),
        (0x1171D, 0x1172B),
        (0x1182C, 0x1183A),
        (0x11930, 0x11935),
        (0x11937, 0x11938),
        (0x1193B, 0x1193E),
        (0x11940, 0x11940),
        (0x11942, 0x11943),
        (0x119D1, 0x119D7),
        (0x119DA, 0x119E0),
        (0x119E4, 0x119E4),
        (0x11A01, 0x11A0A),
        (0x11A33, 0x11A39),
        (0x11A3B, 0x11A3E),
        (0x11A47, 0x11A47),
        (0x11A51, 0x11A5B),
        (0x11A8A, 0x11A99),
        (0x11C2F, 0x11C36),
        (0x11C38, 0x11C3F),
        (0x11C92, 0x11CA7),
        (0x11CA9, 0x11CB6),
        (0x11D31, 0x11D36),
        (0x11D3A, 0x11D3A),
        (0x11D3C, 0x11D3D),
        (0x11D3F, 0x11D45),
        (0x11D47, 0x11D47),
        (0x11D8A, 0x11D8E),
        (0x11D90, 0x11D91),
        (0x11D93, 0x11D97),
        (0x11EF3, 0x11EF6),
        (0x11F00, 0x11F01),
        (0x11F03, 0x11F03),
        (0x11F34, 0x11F3A),
        (0x11F3E, 0x11F42),
        (0x13440, 0x13440),
        (0x13447, 0x13455),
        (0x16AF0, 0x16AF4),
        (0x16B30, 0x16B36),
        (0x16F4F, 0x16F4F),
        (0x16F51, 0x16F87),
        (0x16F8F, 0x16F92),
        (0x16FE4, 0x16FE4),
        (0x16FF0, 0x16FF1),
        (0x1BC9D, 0x1BC9E),
        (0x1CF00, 0x1CF2D),
        (0x1CF30, 0x1CF46),
        (0x1D165, 0x1D169),
        (0x1D16D, 0x1D172),
        (0x1D17B, 0x1D182),
        (0x1D185, 0x1D18B),
        (0x1D1AA, 0x1D1AD),
        (0x1D242, 0x1D244),
        (0x1DA00, 0x1DA36),
        (0x1DA3B, 0x1DA6C),
        (0x1DA75, 0x1DA75),
        (0x1DA84, 0x1DA84),
        (0x1DA9B, 0x1DA9F),
        (0x1DAA1, 0x1DAAF),
        (0x1E000, 0x1E006),
        (0x1E008, 0x1E018),
        (0x1E01B, 0x1E021),
        (0x1E023, 0x1E024),
        (0x1E026, 0x1E02A),
        (0x1E08F, 0x1E08F),
        (0x1E130, 0x1E136),
        (0x1E2AE, 0x1E2AE),
        (0x1E2EC, 0x1E2EF),
        (0x1E4EC, 0x1E4EF),
        (0x1E8D0, 0x1E8D6),
        (0x1E944, 0x1E94A),
        (0xE0100, 0xE01EF),
    ];
    let value = ch as u32;
    let index = RANGES.partition_point(|(_, end)| *end < value);
    RANGES.get(index).is_some_and(|(start, _)| *start <= value)
}

fn word_char(ch: char) -> bool {
    legacy_word_char(ch) || is_combining_mark(ch)
}

fn match_length(text: &str, rule: &Rule) -> Option<usize> {
    if !rule.ignore_case {
        return text.starts_with(&rule.source).then_some(rule.source.len());
    }
    // Compare lowercase scalar streams while tracking ORIGINAL UTF-8 boundaries.
    // E.g. K / Kelvin sign have different byte lengths; İ expands to i + dot.
    // This deliberately does not implement locale-specific folding (ß != ss),
    // canonical normalization, accent stripping, or language detection.
    let mut expected = rule.lowercase_source.chars();
    for (index, ch) in text.char_indices() {
        for lower in ch.to_lowercase() {
            if expected.next() != Some(lower) {
                return None;
            }
        }
        if expected.as_str().is_empty() {
            return Some(index + ch.len_utf8());
        }
    }
    None
}

fn matches_at(text: &str, offset: usize, rule: &Rule) -> Option<usize> {
    let length = match_length(&text[offset..], rule)?;
    let previous = text[..offset].chars().next_back();
    let next = text[offset + length..].chars().next();
    let boundary_ok = match rule.match_mode {
        MatchMode::Exact => true,
        MatchMode::Word => !previous.is_some_and(word_char) && !next.is_some_and(word_char),
        MatchMode::Legacy => {
            let ascii_word = |ch: char| ch.is_ascii_alphanumeric() || ch == '_';
            (!rule.source.chars().next().is_some_and(ascii_word)
                || !previous.is_some_and(legacy_word_char))
                && (!rule.source.chars().next_back().is_some_and(ascii_word)
                    || !next.is_some_and(legacy_word_char))
        }
    };
    boundary_ok.then_some(length)
}

#[allow(dead_code)]
pub fn process(text: &str, rules: &[Rule], formatting: bool) -> Result<String, String> {
    process_for_language(text, rules, formatting, "auto")
}

pub fn preview(text_rules: &str, text: &str, language: &str) -> Result<String, String> {
    if text.len() > MAX_RULE_BYTES {
        return Err("预览文本不能超过 32768 字节".into());
    }
    if language != "auto" && language != "*" && !supported_language(language) {
        return Err("预览语言无效".into());
    }
    let rules = parse_rules(text_rules)?;
    process_for_language(text, &rules, false, language)
}

pub fn process_for_language(
    text: &str,
    rules: &[Rule],
    formatting: bool,
    language: &str,
) -> Result<String, String> {
    const TOKENS: [(&str, &str); 4] = [
        ("【换行】", "\n"),
        ("【分段】", "\n\n"),
        ("[newline]", "\n"),
        ("[paragraph]", "\n\n"),
    ];
    if text.len() > MAX_TEXT_BYTES {
        return Err("处理文本不能超过 1 MiB".into());
    }
    let mut output = String::with_capacity(text.len());
    let mut offset = 0;
    while offset < text.len() {
        // Explicit tokens are recognized from input only, never from rule output.
        if let Some((token, replacement)) = TOKENS
            .iter()
            .find(|(token, _)| formatting && text[offset..].starts_with(token))
        {
            output.push_str(replacement);
            offset += token.len();
        } else if let Some((rule, length)) = rules
            .iter()
            .filter(|rule| {
                rule.language == "*" || (language != "auto" && rule.language == language)
            })
            .filter_map(|rule| matches_at(text, offset, rule).map(|length| (rule, length)))
            .fold(None, |best: Option<(&Rule, usize)>, candidate| match best {
                Some(current)
                    if (current.1, current.0.language != "*")
                        >= (candidate.1, candidate.0.language != "*") =>
                {
                    Some(current)
                }
                _ => Some(candidate),
            })
        {
            output.push_str(&rule.replacement);
            offset += length;
        } else {
            let ch = text[offset..].chars().next().unwrap();
            output.push(ch);
            offset += ch.len_utf8();
        }
        // A small dictionary can otherwise expand repeated input into gigabytes.
        if output.len() > MAX_TEXT_BYTES {
            return Err("词典处理结果不能超过 1 MiB，请缩短替换文字或输入文本".into());
        }
    }
    Ok(output)
}

#[derive(Clone, Serialize, Debug)]
pub struct RecentResult {
    pub id: u64,
    pub text: String,
    pub original: String,
    pub error: Option<String>,
    pub created_at: u64,
}

#[derive(Default)]
pub struct RecentResults {
    enabled: bool,
    generation: u64,
    next_id: u64,
    entries: Vec<RecentResult>,
}

impl RecentResults {
    pub fn set_enabled(&mut self, enabled: bool) {
        if self.enabled != enabled {
            self.generation = self.generation.wrapping_add(1);
        }
        self.enabled = enabled;
        if !enabled {
            self.clear();
        }
    }

    pub fn ticket(&self) -> Option<u64> {
        self.enabled.then_some(self.generation)
    }

    pub fn clear(&mut self) {
        self.entries.clear();
        // Also invalidate any recording still being processed when cleared.
        self.generation = self.generation.wrapping_add(1);
    }

    pub fn entries(&self) -> Vec<RecentResult> {
        self.entries.iter().rev().cloned().collect()
    }

    pub fn add(
        &mut self,
        ticket: Option<u64>,
        text: String,
        original: String,
        error: Option<String>,
    ) -> bool {
        if ticket.is_none() || ticket != self.ticket() || original.is_empty() {
            return false;
        }
        self.next_id = self.next_id.saturating_add(1);
        self.entries.push(RecentResult {
            id: self.next_id,
            text,
            original,
            error,
            created_at: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        });
        if self.entries.len() > MAX_RESULTS {
            self.entries.remove(0);
        }
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replacements_are_literal_longest_and_non_cascading() {
        let rules =
            parse_rules("猫 => 狗\n猫咪 => kitten\n狗 => 鱼\na.b => exact\ncat => dog").unwrap();
        assert_eq!(
            process("猫咪 猫 狗 a.b cat", &rules, false).unwrap(),
            "kitten 狗 鱼 exact dog"
        );
        assert_eq!(process("猫猫", &rules, false).unwrap(), "狗狗");
    }

    #[test]
    fn ascii_words_respect_unicode_boundaries() {
        let rules = parse_rules("cat => dog").unwrap();
        assert_eq!(
            process("cat cats cat_1 écat 猫cat cat猫 (cat)!", &rules, false).unwrap(),
            "dog cats cat_1 écat 猫cat cat猫 (dog)!"
        );
    }

    #[test]
    fn formatting_is_explicit_opt_in_and_non_cascading() {
        let input = "换行 newline 【换行】A[paragraph]B【分段】C[newline]";
        assert_eq!(process(input, &[], false).unwrap(), input);
        assert_eq!(
            process(input, &[], true).unwrap(),
            "换行 newline \nA\n\nB\n\nC\n"
        );
        assert_eq!(
            process("cat", &parse_rules("cat => [newline]").unwrap(), true).unwrap(),
            "[newline]"
        );
    }

    #[test]
    fn rules_validate_size_count_source_and_syntax() {
        assert!(parse_rules(" => replacement").is_err());
        assert!(parse_rules("missing separator").is_err());
        assert!(parse_rules("a => b\na => c").is_err());
        assert!(parse_rules(&"x".repeat(MAX_RULE_BYTES + 1)).is_err());
        let many = (0..=MAX_RULES)
            .map(|i| format!("s{i} => x"))
            .collect::<Vec<_>>()
            .join("\n");
        assert!(parse_rules(&many).is_err());
        assert!(parse_rules("\n  \na => \n").is_ok());
    }

    #[test]
    fn dictionary_expansion_is_bounded_for_preview_and_dictation() {
        let raw = format!("猫 => {}", "x".repeat(4096));
        let rules = parse_rules(&raw).unwrap();
        assert_eq!(
            process(&"猫".repeat(256), &rules, false).unwrap().len(),
            MAX_TEXT_BYTES
        );
        assert!(process(&"猫".repeat(257), &rules, false).is_err());
        assert!(preview(&raw, &"猫".repeat(257), "auto").is_err());
        assert!(process(&"x".repeat(MAX_TEXT_BYTES + 1), &[], false).is_err());
        assert_eq!(
            process("猫", &parse_rules("猫 => ").unwrap(), false).unwrap(),
            ""
        );
    }

    fn json_rule(
        source: &str,
        replacement: &str,
        language: &str,
        mode: &str,
        ignore_case: bool,
    ) -> serde_json::Value {
        serde_json::json!({"source":source,"replacement":replacement,"language":language,"match_mode":mode,"ignore_case":ignore_case})
    }

    #[test]
    fn structured_english_casing_and_unicode_byte_lengths_are_safe() {
        let rules = serde_json::json!([
            json_rule("open ai", "OpenAI", "en", "word", true),
            json_rule("K", "kelvin", "*", "word", true),
            json_rule("i\u{307}", "dotted", "*", "exact", true),
            json_rule("ß", "eszett", "*", "word", true),
        ])
        .to_string();
        assert_eq!(
            preview(&rules, "Open AI OPEN AI open ais K k İ! SS ß", "en").unwrap(),
            "OpenAI OpenAI open ais kelvin kelvin dotted! SS eszett"
        );
        let expansion = serde_json::json!([json_rule("i", "x", "*", "exact", true)]).to_string();
        assert_eq!(preview(&expansion, "İ", "auto").unwrap(), "İ");
    }

    #[test]
    fn lowercase_is_scalar_based_not_contextual_or_locale_case_folding() {
        let rules = serde_json::json!([
            json_rule("ΟΣ", "Greek", "el", "word", true),
            json_rule("I", "latin", "tr", "word", true),
        ])
        .to_string();
        assert_eq!(preview(&rules, "ΟΣ οσ ος", "el").unwrap(), "Greek Greek ος");
        assert_eq!(preview(&rules, "I i ı", "tr").unwrap(), "latin latin ı");
    }

    #[test]
    fn chinese_japanese_exact_rules_and_language_scopes_work() {
        let rules = serde_json::json!([
            json_rule("词", "通用", "*", "exact", false),
            json_rule("词", "中文", "zh", "exact", false),
            json_rule("词组", "长词", "*", "exact", false),
            json_rule("チャットGPT", "ChatGPT", "ja", "exact", false),
        ])
        .to_string();
        assert_eq!(preview(&rules, "词 词组", "zh").unwrap(), "中文 长词");
        assert_eq!(preview(&rules, "词 词组", "auto").unwrap(), "通用 长词");
        assert_eq!(
            preview(&rules, "我用チャットGPTです", "ja").unwrap(),
            "我用ChatGPTです"
        );
        assert_eq!(preview(&rules, "チャットGPT", "fr").unwrap(), "チャットGPT");
    }

    #[test]
    fn french_word_boundaries_include_combining_marks_without_normalization() {
        let rules = serde_json::json!([
            json_rule("café", "coffee", "fr", "word", true),
            json_rule("e", "E", "fr", "word", false),
            json_rule("chat", "cat", "fr", "word", false),
        ])
        .to_string();
        assert_eq!(
            preview(
                &rules,
                "CAFÉ café cafétéria cafe\u{301} e\u{301} e chat chat_1 \u{301}chat chat\u{301}",
                "fr"
            )
            .unwrap(),
            "coffee coffee cafétéria cafe\u{301} e\u{301} E cat chat_1 \u{301}chat chat\u{301}"
        );
        assert!(word_char('\u{301}'));
        assert!(word_char('\u{903}'));
        assert!(word_char('\u{20dd}'));
        assert!(!word_char('!'));
    }

    #[test]
    fn structured_legacy_migration_preserves_legacy_behavior() {
        let legacy = "cat => dog\n猫 => 狗\n[newline] => marker";
        let migrated = serde_json::json!([
            json_rule("cat", "dog", "*", "legacy", false),
            json_rule("猫", "狗", "*", "legacy", false),
            json_rule("[newline]", "marker", "*", "legacy", false),
        ])
        .to_string();
        let text = "cat cats écat 猫猫 cat\u{301} [newline]";
        assert_eq!(
            preview(legacy, text, "auto").unwrap(),
            preview(&migrated, text, "auto").unwrap()
        );
        assert_eq!(preview("[newline] => x", "[newline]", "auto").unwrap(), "x");
        assert_eq!(preview("{name} => x", "{name}", "auto").unwrap(), "x");
    }

    #[test]
    fn structured_json_validation_is_strict_and_conflicts_are_language_scoped() {
        let valid = json_rule("Open AI", "OpenAI", "en", "word", true);
        for key in [
            "source",
            "replacement",
            "language",
            "match_mode",
            "ignore_case",
        ] {
            let mut missing = valid.clone();
            missing.as_object_mut().unwrap().remove(key);
            assert!(
                parse_rules(&serde_json::json!([missing]).to_string()).is_err(),
                "missing {key}"
            );
        }
        let mut unknown = valid.clone();
        unknown["extra"] = true.into();
        assert!(parse_rules(&serde_json::json!([unknown]).to_string()).is_err());
        for (key, value) in [
            ("language", serde_json::json!("auto")),
            ("match_mode", serde_json::json!("regex")),
            ("ignore_case", serde_json::json!("true")),
            ("source", serde_json::json!(null)),
        ] {
            let mut invalid = valid.clone();
            invalid[key] = value;
            assert!(parse_rules(&serde_json::json!([invalid]).to_string()).is_err());
        }
        assert!(parse_rules("[{broken]").is_err());
        assert!(parse_rules("{\"source\":\"x => y\"}").is_err());
        assert!(parse_rules(
            &serde_json::json!([
                valid.clone(),
                json_rule("open ai", "other", "en", "exact", false)
            ])
            .to_string()
        )
        .is_err());
        assert!(parse_rules(
            &serde_json::json!([
                valid.clone(),
                json_rule("open ai", "other", "*", "exact", false)
            ])
            .to_string()
        )
        .is_ok());
        assert!(parse_rules(
            &serde_json::json!([
                json_rule("A", "x", "en", "exact", false),
                json_rule("a", "y", "en", "exact", false)
            ])
            .to_string()
        )
        .is_ok());
        let many = vec![valid; MAX_RULES + 1];
        assert!(parse_rules(&serde_json::to_string(&many).unwrap()).is_err());
    }

    #[test]
    fn preview_uses_matcher_without_formatting_and_rejects_oversized_text() {
        assert_eq!(
            preview("", "【换行】[newline]", "auto").unwrap(),
            "【换行】[newline]"
        );
        assert_eq!(preview("", "", "auto").unwrap(), "");
        assert!(preview("", &"é".repeat(MAX_RULE_BYTES / 2 + 1), "fr").is_err());
        assert!(preview("", "text", "unknown").is_err());
        let rules = serde_json::json!([
            json_rule("a", "b", "*", "exact", false),
            json_rule("b", "c", "*", "exact", false)
        ])
        .to_string();
        assert_eq!(preview(&rules, "ab", "auto").unwrap(), "bc");
    }

    #[test]
    fn actual_matched_length_beats_source_byte_length() {
        let rules = serde_json::json!([
            json_rule("K", "short", "*", "exact", true),
            json_rule("k!", "long", "en", "exact", false),
        ])
        .to_string();
        assert_eq!(preview(&rules, "k!", "en").unwrap(), "long");
    }

    #[test]
    fn history_is_opt_in_bounded_clearable_and_invalidates_inflight() {
        let mut history = RecentResults::default();
        assert!(!history.add(None, "a".into(), "a".into(), None));
        history.set_enabled(true);
        let ticket = history.ticket();
        for i in 0..12 {
            assert!(history.add(ticket, i.to_string(), "raw".into(), Some("error".into())));
        }
        assert_eq!(history.entries().len(), 10);
        assert_eq!(history.entries()[0].text, "11");
        assert_eq!(history.entries()[9].text, "2");
        history.clear();
        assert!(history.entries().is_empty());
        assert!(!history.add(ticket, "late".into(), "raw".into(), None));
        let ticket = history.ticket();
        assert!(history.add(ticket, "new".into(), "raw".into(), None));
        history.set_enabled(false);
        history.set_enabled(true);
        assert!(history.entries().is_empty());
        assert!(!history.add(ticket, "late".into(), "raw".into(), None));
    }
}

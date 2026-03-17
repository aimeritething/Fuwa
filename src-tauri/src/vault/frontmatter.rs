use crate::vault::parsing::{contains_wikilink, parse_iso_date};
use serde::Deserialize;
use std::collections::HashMap;

/// Intermediate struct to capture YAML frontmatter fields.
#[derive(Debug, Deserialize, Default)]
pub(crate) struct Frontmatter {
    #[serde(rename = "type", alias = "Is A", alias = "is_a")]
    pub is_a: Option<StringOrList>,
    #[serde(default)]
    pub aliases: Option<StringOrList>,
    #[serde(rename = "Belongs to")]
    pub belongs_to: Option<StringOrList>,
    #[serde(rename = "Related to")]
    pub related_to: Option<StringOrList>,
    #[serde(rename = "Status")]
    pub status: Option<String>,
    #[serde(rename = "Owner")]
    pub owner: Option<StringOrList>,
    #[serde(rename = "Cadence")]
    pub cadence: Option<StringOrList>,
    #[serde(
        rename = "Archived",
        alias = "archived",
        default,
        deserialize_with = "deserialize_bool_or_string"
    )]
    pub archived: Option<bool>,
    #[serde(
        rename = "Trashed",
        alias = "trashed",
        default,
        deserialize_with = "deserialize_bool_or_string"
    )]
    pub trashed: Option<bool>,
    #[serde(rename = "Trashed at", alias = "trashed_at")]
    pub trashed_at: Option<String>,
    #[serde(rename = "Created at")]
    pub created_at: Option<String>,
    #[serde(rename = "Created time")]
    pub created_time: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub order: Option<i64>,
    #[serde(rename = "sidebar label", default)]
    pub sidebar_label: Option<String>,
    #[serde(default)]
    pub template: Option<String>,
    #[serde(default)]
    pub sort: Option<String>,
    #[serde(default)]
    pub view: Option<String>,
    #[serde(default)]
    pub visible: Option<bool>,
}

/// Custom deserializer for boolean fields that may arrive as strings.
/// YAML `Yes`/`No` get converted to JSON strings by gray_matter, so we
/// need to accept both actual booleans and their string representations.
fn deserialize_bool_or_string<'de, D>(deserializer: D) -> Result<Option<bool>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de;

    struct BoolOrStringVisitor;

    impl<'de> de::Visitor<'de> for BoolOrStringVisitor {
        type Value = Option<bool>;

        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            f.write_str("a boolean or a string representing a boolean")
        }

        fn visit_bool<E: de::Error>(self, v: bool) -> Result<Self::Value, E> {
            Ok(Some(v))
        }

        fn visit_str<E: de::Error>(self, v: &str) -> Result<Self::Value, E> {
            match v.to_lowercase().as_str() {
                "true" | "yes" | "1" => Ok(Some(true)),
                "false" | "no" | "0" | "" => Ok(Some(false)),
                _ => Ok(Some(false)),
            }
        }

        fn visit_i64<E: de::Error>(self, v: i64) -> Result<Self::Value, E> {
            Ok(Some(v != 0))
        }

        fn visit_u64<E: de::Error>(self, v: u64) -> Result<Self::Value, E> {
            Ok(Some(v != 0))
        }

        fn visit_none<E: de::Error>(self) -> Result<Self::Value, E> {
            Ok(None)
        }

        fn visit_unit<E: de::Error>(self) -> Result<Self::Value, E> {
            Ok(None)
        }
    }

    deserializer.deserialize_any(BoolOrStringVisitor)
}

/// Handles YAML fields that can be either a single string or a list of strings.
#[derive(Debug, Deserialize, Clone)]
#[serde(untagged)]
pub(crate) enum StringOrList {
    Single(String),
    List(Vec<String>),
}

impl StringOrList {
    pub fn into_vec(self) -> Vec<String> {
        match self {
            StringOrList::Single(s) => vec![s],
            StringOrList::List(v) => v,
        }
    }
}

/// Parse frontmatter from raw YAML data extracted by gray_matter.
fn parse_frontmatter(data: &HashMap<String, serde_json::Value>) -> Frontmatter {
    // Convert HashMap to serde_json::Value for deserialization.
    // Filter to only known Frontmatter keys to prevent unknown fields with
    // unexpected types (e.g. a list where a string is expected) from causing
    // the entire deserialization to fail and return Default (all None).
    static KNOWN_KEYS: &[&str] = &[
        "type",
        "Is A",
        "is_a",
        "aliases",
        "Belongs to",
        "Related to",
        "Status",
        "Owner",
        "Cadence",
        "Archived",
        "archived",
        "Trashed",
        "trashed",
        "Trashed at",
        "trashed_at",
        "Created at",
        "Created time",
        "icon",
        "color",
        "order",
        "sidebar label",
        "template",
        "sort",
        "view",
        "visible",
        "notion_id",
    ];
    let filtered: serde_json::Map<String, serde_json::Value> = data
        .iter()
        .filter(|(k, _)| KNOWN_KEYS.contains(&k.as_str()))
        .map(|(k, v)| (k.clone(), v.clone()))
        .collect();
    let value = serde_json::Value::Object(filtered);
    serde_json::from_value(value).unwrap_or_default()
}

/// Known non-relationship frontmatter keys to skip (case-insensitive comparison).
/// Only skip keys that can never contain wikilinks.
const SKIP_KEYS: &[&str] = &[
    "is a",
    "type",
    "aliases",
    "status",
    "cadence",
    "archived",
    "trashed",
    "trashed at",
    "created at",
    "created time",
    "icon",
    "color",
    "order",
    "sidebar label",
    "template",
    "sort",
    "view",
    "visible",
];

/// Extract all wikilink-containing fields from raw YAML frontmatter.
/// Returns a HashMap where each key is the original frontmatter field name
/// and the value is a Vec of wikilink strings found in that field.
/// Handles both single string values and arrays of strings.
fn extract_relationships(
    data: &HashMap<String, serde_json::Value>,
) -> HashMap<String, Vec<String>> {
    let mut relationships = HashMap::new();

    for (key, value) in data {
        // Skip known non-relationship keys
        if SKIP_KEYS.iter().any(|k| k.eq_ignore_ascii_case(key)) {
            continue;
        }

        match value {
            serde_json::Value::String(s) => {
                if contains_wikilink(s) {
                    relationships.insert(key.clone(), vec![s.clone()]);
                }
            }
            serde_json::Value::Array(arr) => {
                let wikilinks: Vec<String> = arr
                    .iter()
                    .filter_map(|v| v.as_str())
                    .filter(|s| contains_wikilink(s))
                    .map(|s| s.to_string())
                    .collect();
                if !wikilinks.is_empty() {
                    relationships.insert(key.clone(), wikilinks);
                }
            }
            _ => {}
        }
    }

    relationships
}

/// Additional keys to skip when extracting custom properties.
/// These are already first-class fields on VaultEntry, so including them
/// in `properties` would duplicate information.
const PROPERTY_EXTRA_SKIP: &[&str] = &["belongs to", "related to", "owner"];

/// Extract custom scalar properties from raw YAML frontmatter.
/// Captures string, number, and boolean values that are not structural fields
/// and do not contain wikilinks. Arrays and objects are excluded.
fn extract_properties(
    data: &HashMap<String, serde_json::Value>,
) -> HashMap<String, serde_json::Value> {
    let mut properties = HashMap::new();

    for (key, value) in data {
        let lower = key.to_ascii_lowercase();
        if SKIP_KEYS.iter().any(|k| k.eq_ignore_ascii_case(&lower))
            || PROPERTY_EXTRA_SKIP
                .iter()
                .any(|k| k.eq_ignore_ascii_case(&lower))
        {
            continue;
        }

        match value {
            serde_json::Value::String(s) => {
                if !contains_wikilink(s) {
                    properties.insert(key.clone(), value.clone());
                }
            }
            serde_json::Value::Number(_) | serde_json::Value::Bool(_) => {
                properties.insert(key.clone(), value.clone());
            }
            _ => {}
        }
    }

    properties
}

/// Resolve `is_a` from frontmatter only. Type is determined purely by frontmatter,
/// never inferred from folder name.
pub(crate) fn resolve_is_a(fm_is_a: Option<StringOrList>) -> Option<String> {
    fm_is_a.and_then(|a| a.into_vec().into_iter().next())
}

/// Parse created_at from frontmatter (prefer "Created at" over "Created time").
pub(crate) fn parse_created_at(fm: &Frontmatter) -> Option<u64> {
    fm.created_at
        .as_ref()
        .and_then(|s| parse_iso_date(s))
        .or_else(|| fm.created_time.as_ref().and_then(|s| parse_iso_date(s)))
}

/// Convert gray_matter::Pod to serde_json::Value
fn pod_to_json(pod: gray_matter::Pod) -> serde_json::Value {
    match pod {
        gray_matter::Pod::String(s) => serde_json::Value::String(s),
        gray_matter::Pod::Integer(i) => serde_json::json!(i),
        gray_matter::Pod::Float(f) => serde_json::json!(f),
        gray_matter::Pod::Boolean(b) => serde_json::Value::Bool(b),
        gray_matter::Pod::Array(arr) => {
            serde_json::Value::Array(arr.into_iter().map(pod_to_json).collect())
        }
        gray_matter::Pod::Hash(map) => {
            let obj: serde_json::Map<String, serde_json::Value> =
                map.into_iter().map(|(k, v)| (k, pod_to_json(v))).collect();
            serde_json::Value::Object(obj)
        }
        gray_matter::Pod::Null => serde_json::Value::Null,
    }
}

/// Extract frontmatter, relationships, and custom properties from parsed gray_matter data.
pub(crate) fn extract_fm_and_rels(
    data: Option<gray_matter::Pod>,
) -> (
    Frontmatter,
    HashMap<String, Vec<String>>,
    HashMap<String, serde_json::Value>,
) {
    let hash = match data {
        Some(gray_matter::Pod::Hash(map)) => map,
        _ => return (Frontmatter::default(), HashMap::new(), HashMap::new()),
    };
    let json_map: HashMap<String, serde_json::Value> =
        hash.into_iter().map(|(k, v)| (k, pod_to_json(v))).collect();
    (
        parse_frontmatter(&json_map),
        extract_relationships(&json_map),
        extract_properties(&json_map),
    )
}

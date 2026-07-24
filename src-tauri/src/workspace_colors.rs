use serde::Deserialize;
use std::collections::HashMap;
use std::sync::OnceLock;

const WORKSPACE_COLOR_CONTRACT_JSON: &str =
    include_str!("../../src/shared/workspaceColorContract.json");

#[derive(Debug, Deserialize)]
struct WorkspaceColorContract {
    default: String,
    colors: HashMap<String, WorkspaceColorDefinition>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceColorDefinition {
    native_icon: Option<NativeIconPalette>,
}

#[derive(Debug, Deserialize)]
struct NativeIconPalette {
    light: [u8; 3],
    dark: [u8; 3],
}

fn contract() -> &'static WorkspaceColorContract {
    static CONTRACT: OnceLock<WorkspaceColorContract> = OnceLock::new();
    CONTRACT.get_or_init(|| {
        serde_json::from_str(WORKSPACE_COLOR_CONTRACT_JSON)
            .expect("workspace color contract must be valid JSON")
    })
}

pub fn normalize(value: &str) -> Option<String> {
    let normalized = value.trim().to_ascii_lowercase();
    contract()
        .colors
        .contains_key(&normalized)
        .then_some(normalized)
}

pub fn app_icon_rgb(value: Option<&str>, dark: bool) -> [u8; 3] {
    let contract = contract();
    let requested_palette = value
        .and_then(normalize)
        .and_then(|color| contract.colors.get(&color))
        .and_then(|definition| definition.native_icon.as_ref());
    let default_palette = contract
        .colors
        .get(&contract.default)
        .and_then(|definition| definition.native_icon.as_ref())
        .expect("default workspace color must define a native icon palette");
    let palette = requested_palette.unwrap_or(default_palette);
    if dark {
        palette.dark
    } else {
        palette.light
    }
}

#[cfg(test)]
mod tests {
    use super::{app_icon_rgb, normalize};

    #[test]
    fn normalizes_every_renderer_workspace_color() {
        for color in [
            "red", "orange", "yellow", "green", "blue", "purple", "pink", "gray",
        ] {
            assert_eq!(normalize(&color.to_uppercase()).as_deref(), Some(color));
        }
        assert_eq!(normalize("cyan"), None);
    }

    #[test]
    fn renderer_only_colors_use_the_declared_default_icon_palette() {
        assert_eq!(app_icon_rgb(Some("pink"), false), [21, 93, 255]);
        assert_eq!(app_icon_rgb(Some("gray"), true), [120, 164, 255]);
    }
}

fn main() {
    // Ensure resource directories exist for the Tauri build.
    // These are gitignored and populated by scripts (bundle-mcp-server.mjs).
    // Without a placeholder, `tauri build` / `cargo test` fails if the scripts haven't run.
    for dir in ["resources/mcp-server"] {
        let path = std::path::Path::new(dir);
        if !path.exists() {
            std::fs::create_dir_all(path).ok();
            std::fs::write(path.join(".placeholder"), "").ok();
        }
    }
    tauri_build::build()
}

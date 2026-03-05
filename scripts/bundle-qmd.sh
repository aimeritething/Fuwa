#!/usr/bin/env bash
# Bundle qmd into a self-contained directory for Tauri resource embedding.
#
# Output: src-tauri/resources/qmd/
#   qmd                                  — compiled standalone binary
#   node_modules/sqlite-vec/             — JS shim for sqlite-vec
#   node_modules/sqlite-vec-darwin-arm64/ — native .dylib (arm64)
#   node_modules/sqlite-vec-darwin-x64/  — native .dylib (x64)
#   node_modules/node-llama-cpp/         — stub (keyword search only)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
OUT="$ROOT/src-tauri/resources/qmd"

# ---------- locate tools ----------
find_bun() {
  for c in \
    "$HOME/.bun/bin/bun" \
    "/opt/homebrew/bin/bun" \
    "/usr/local/bin/bun"; do
    [[ -x "$c" ]] && { echo "$c"; return 0; }
  done
  command -v bun 2>/dev/null && return 0
  return 1
}

BUN=$(find_bun) || { echo "ERROR: bun not found — install from https://bun.sh" >&2; exit 1; }
echo "Using bun: $BUN"

# ---------- locate qmd source ----------
QMD_SRC=""
for c in \
  "$HOME/.bun/install/global/node_modules/qmd" \
  "/opt/homebrew/lib/node_modules/qmd" \
  "/usr/local/lib/node_modules/qmd"; do
  [[ -f "$c/src/qmd.ts" ]] && { QMD_SRC="$c"; break; }
done

if [[ -z "$QMD_SRC" ]]; then
  echo "qmd not found globally — installing via bun..."
  "$BUN" install -g qmd
  QMD_SRC="$HOME/.bun/install/global/node_modules/qmd"
  [[ -f "$QMD_SRC/src/qmd.ts" ]] || { echo "ERROR: qmd install succeeded but source not found at $QMD_SRC" >&2; exit 1; }
fi
echo "Using qmd source: $QMD_SRC"

# ---------- compile ----------
echo "Compiling qmd with bun build --compile..."
mkdir -p "$OUT"

"$BUN" build --compile \
  "$QMD_SRC/src/qmd.ts" \
  --outfile "$OUT/qmd" \
  --external node-llama-cpp \
  --external sqlite-vec \
  --external sqlite-vec-darwin-arm64 \
  --external sqlite-vec-darwin-x64

chmod +x "$OUT/qmd"

# ---------- bundle sqlite-vec ----------
echo "Bundling sqlite-vec native extensions..."

# Find sqlite-vec packages in bun cache
BUN_CACHE="$HOME/.bun/install/cache"

# sqlite-vec JS shim
SQLVEC_DIR=$(find "$BUN_CACHE" -maxdepth 1 -name "sqlite-vec@*" -type d | head -1)
if [[ -z "$SQLVEC_DIR" ]]; then
  echo "ERROR: sqlite-vec not found in bun cache" >&2; exit 1
fi

mkdir -p "$OUT/node_modules/sqlite-vec"
cp "$SQLVEC_DIR/index.mjs" "$OUT/node_modules/sqlite-vec/index.mjs"
cp "$SQLVEC_DIR/package.json" "$OUT/node_modules/sqlite-vec/package.json"
# Also copy CJS entry if it exists
[[ -f "$SQLVEC_DIR/index.cjs" ]] && cp "$SQLVEC_DIR/index.cjs" "$OUT/node_modules/sqlite-vec/index.cjs"

# sqlite-vec-darwin-arm64
ARM64_DIR=$(find "$BUN_CACHE" -maxdepth 1 -name "sqlite-vec-darwin-arm64@*" -type d | head -1)
if [[ -n "$ARM64_DIR" ]]; then
  mkdir -p "$OUT/node_modules/sqlite-vec-darwin-arm64"
  cp "$ARM64_DIR/vec0.dylib" "$OUT/node_modules/sqlite-vec-darwin-arm64/vec0.dylib"
  cp "$ARM64_DIR/package.json" "$OUT/node_modules/sqlite-vec-darwin-arm64/package.json"
  echo "  ✓ arm64 dylib"
fi

# sqlite-vec-darwin-x64
X64_DIR=$(find "$BUN_CACHE" -maxdepth 1 -name "sqlite-vec-darwin-x64@*" -type d | head -1)
if [[ -n "$X64_DIR" ]]; then
  mkdir -p "$OUT/node_modules/sqlite-vec-darwin-x64"
  cp "$X64_DIR/vec0.dylib" "$OUT/node_modules/sqlite-vec-darwin-x64/vec0.dylib"
  cp "$X64_DIR/package.json" "$OUT/node_modules/sqlite-vec-darwin-x64/package.json"
  echo "  ✓ x64 dylib"
fi

# ---------- stub node-llama-cpp ----------
echo "Creating node-llama-cpp stub (keyword search only)..."
mkdir -p "$OUT/node_modules/node-llama-cpp"

cat > "$OUT/node_modules/node-llama-cpp/package.json" << 'PJSON'
{"name":"node-llama-cpp","version":"0.0.0-stub","type":"module","main":"index.js"}
PJSON

cat > "$OUT/node_modules/node-llama-cpp/index.js" << 'STUB'
// Stub: node-llama-cpp not bundled — semantic search unavailable, keyword search works.
const unavailable = (name) => (...args) => {
  throw new Error(`${name}() unavailable: node-llama-cpp not bundled. Keyword search still works.`);
};
export const getLlama = unavailable("getLlama");
export const resolveModelFile = unavailable("resolveModelFile");
export class LlamaChatSession {
  constructor() { throw new Error("LlamaChatSession unavailable"); }
}
export const LlamaLogLevel = { Error: 0, Warn: 1, Info: 2, Debug: 3 };
STUB

# ---------- ad-hoc code signing (macOS) ----------
if [[ "$(uname)" == "Darwin" ]] && command -v codesign &>/dev/null; then
  echo "Ad-hoc signing bundled binaries..."
  codesign --force --sign - "$OUT/qmd" 2>/dev/null && echo "  ✓ qmd signed" || echo "  ⚠ qmd signing failed (non-fatal)"
  find "$OUT/node_modules" -name "*.dylib" -exec sh -c 'codesign --force --sign - "$1" 2>/dev/null && echo "  ✓ $(basename "$1") signed"' _ {} \;
fi

# ---------- summary ----------
echo ""
echo "qmd bundled → $OUT/"
du -sh "$OUT/qmd"
du -sh "$OUT/node_modules"
echo "Done."

#!/usr/bin/env bash
set -euo pipefail

start_time=$(date +%s)

log_rust() {
  printf '[sidecar-rust +%ss] %s\n' "$(($(date +%s) - start_time))" "$*"
}

mkdir -p "$HOME/Documents"
# shellcheck disable=SC1091
. "$HOME/.cargo/env"
export CARGO_BUILD_JOBS="${CARGO_BUILD_JOBS:-2}"

log_rust 'clippy started'
cargo clippy --manifest-path=src-tauri/Cargo.toml -- -D warnings
log_rust 'clippy passed'

log_rust 'rustfmt started'
cargo fmt --manifest-path=src-tauri/Cargo.toml -- --check
log_rust 'rustfmt passed'

log_rust 'coverage started'
coverage_args=(
  --manifest-path src-tauri/Cargo.toml
  --no-clean
  --ignore-filename-regex "lib\\.rs|main\\.rs|menu\\.rs"
  --fail-under-lines 85
)
if [[ -n "${RUST_COVERAGE_LCOV_OUTPUT:-}" ]]; then
  mkdir -p "$(dirname "$RUST_COVERAGE_LCOV_OUTPUT")"
  coverage_args+=(--lcov --output-path "$RUST_COVERAGE_LCOV_OUTPUT")
fi
cargo llvm-cov "${coverage_args[@]}" -- --test-threads=1
log_rust "completed in $(($(date +%s) - start_time))s"

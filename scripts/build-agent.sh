#!/usr/bin/env bash
# scripts/build-agent.sh
#
# Cross-compile the OxideTerm agent binary for Linux targets.
# Produces statically-linked musl binaries suitable for deployment
# to any Linux host.
#
# Usage:
#   ./scripts/build-agent.sh              # Build both architectures
#   ./scripts/build-agent.sh x86_64       # Build x86_64 only
#   ./scripts/build-agent.sh aarch64      # Build aarch64 only
#
# Prerequisites:
#   rustup target add x86_64-unknown-linux-musl
#   rustup target add aarch64-unknown-linux-musl
#
# For cross-compilation from macOS:
#   brew install filosottile/musl-cross/musl-cross
#   brew install messense/macos-cross-toolchains/aarch64-unknown-linux-musl
#
# Alternatively, use the `cross` tool:
#   cargo install cross
#   Set USE_CROSS=1 to use cross instead of cargo

set -euo pipefail

AGENT_DIR="$(cd "$(dirname "$0")/../agent" && pwd)"
OUTPUT_DIR="$(cd "$(dirname "$0")/../src-tauri/agents" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[agent-build]${NC} $*"; }
warn() { echo -e "${YELLOW}[agent-build]${NC} $*"; }
error() { echo -e "${RED}[agent-build]${NC} $*" >&2; }

BUILD_CMD="${USE_CROSS:+cross}"
BUILD_CMD="${BUILD_CMD:-cargo}"

build_target() {
  local arch="$1"
  local target="${arch}-unknown-linux-musl"
  local output_name="oxideterm-agent-${arch}-linux-musl"

  log "Building agent for ${target}..."

  if [[ "$BUILD_CMD" == "cross" ]]; then
    (cd "$AGENT_DIR" && cross build --release --target "$target")
  else
    # Check if the linker is configured for cross-compilation
    local linker_var="CARGO_TARGET_$(echo "$target" | tr '[:lower:]-' '[:upper:]_')_LINKER"
    
    if [[ "$arch" == "x86_64" ]]; then
      export CC_x86_64_unknown_linux_musl="${CC_x86_64_unknown_linux_musl:-x86_64-linux-musl-gcc}"
      export CARGO_TARGET_X86_64_UNKNOWN_LINUX_MUSL_LINKER="${!linker_var:-x86_64-linux-musl-gcc}"
    elif [[ "$arch" == "aarch64" ]]; then
      export CC_aarch64_unknown_linux_musl="${CC_aarch64_unknown_linux_musl:-aarch64-linux-musl-gcc}"
      export CARGO_TARGET_AARCH64_UNKNOWN_LINUX_MUSL_LINKER="${!linker_var:-aarch64-linux-musl-gcc}"
    fi
    
    (cd "$AGENT_DIR" && cargo build --release --target "$target")
  fi

  # Copy to output directory
  local binary_path="$AGENT_DIR/target/$target/release/oxideterm-agent"
  
  if [[ ! -f "$binary_path" ]]; then
    error "Binary not found at $binary_path"
    return 1
  fi

  mkdir -p "$OUTPUT_DIR"
  cp "$binary_path" "$OUTPUT_DIR/$output_name"
  
  local size
  size=$(wc -c < "$OUTPUT_DIR/$output_name" | tr -d ' ')
  local size_mb
  size_mb=$(echo "scale=1; $size / 1048576" | bc 2>/dev/null || echo "?")
  
  log "✓ ${output_name} — ${size_mb} MB"
}

# Determine which targets to build
TARGETS=("x86_64" "aarch64")
if [[ $# -gt 0 ]]; then
  TARGETS=("$1")
fi

log "Output directory: $OUTPUT_DIR"

for target in "${TARGETS[@]}"; do
  build_target "$target"
done

log "Done! Agent binaries are in $OUTPUT_DIR"
ls -lh "$OUTPUT_DIR"/oxideterm-agent-* 2>/dev/null || true

# OxideTerm Agent Binaries

This directory contains pre-compiled agent binaries for the OxideTerm IDE mode.

## Directory Structure

```
agents/
└── extra/           # Extra architectures (not bundled with app)
    ├── README.md
    └── oxideterm-agent-*
```

## Bundled vs Extra

**Bundled** (auto-deployed, included in app package):
- `x86_64-unknown-linux-musl` - Standard 64-bit Linux
- `aarch64-unknown-linux-musl` - ARM64 Linux (e.g., AWS Graviton, Apple Silicon VMs)

**Extra** (manual download required):
- See `extra/README.md` for the full list of additional architectures

## Building

To compile agents for all supported targets:

```bash
cd agent

# Bundled targets
cross build --release --target x86_64-unknown-linux-musl
cross build --release --target aarch64-unknown-linux-musl

# Extra targets
cross build --release --target armv7-unknown-linux-musleabihf
cross build --release --target arm-unknown-linux-musleabihf
cross build --release --target i686-unknown-linux-musl
cross build --release --target powerpc64le-unknown-linux-gnu
cross build --release --target s390x-unknown-linux-gnu
cross build --release --target riscv64gc-unknown-linux-gnu
cross build --release --target loongarch64-unknown-linux-gnu
cross build --release --target aarch64-linux-android
cross build --release --target x86_64-unknown-freebsd
```

Requires: [cross](https://github.com/cross-rs/cross) + Docker

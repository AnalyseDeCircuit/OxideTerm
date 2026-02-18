# OxideTerm Agent - Extra Architectures

Pre-compiled agent binaries for architectures not bundled with the main application.

## Usage

1. Download the appropriate binary for your remote host's architecture
2. Upload to the remote host at `~/.oxideterm/oxideterm-agent`
3. Make it executable: `chmod +x ~/.oxideterm/oxideterm-agent`
4. In OxideTerm IDE mode, click "Retry Deploy" to activate the agent

## Available Binaries

| File | Architecture | OS | Notes |
|------|-------------|-----|-------|
| `oxideterm-agent-armv7-linux-musleabihf` | ARMv7 32-bit | Linux | Raspberry Pi, older ARM boards |
| `oxideterm-agent-arm-linux-musleabihf` | ARM 32-bit | Linux | Older ARM devices |
| `oxideterm-agent-i686-linux-musl` | x86 32-bit | Linux | Legacy 32-bit systems |
| `oxideterm-agent-powerpc64le-linux-gnu` | PowerPC 64-bit LE | Linux | IBM POWER systems |
| `oxideterm-agent-s390x-linux-gnu` | IBM Z (s390x) | Linux | IBM mainframes |
| `oxideterm-agent-riscv64gc-linux-gnu` | RISC-V 64-bit | Linux | RISC-V boards |
| `oxideterm-agent-loongarch64-linux-gnu` | LoongArch 64-bit | Linux | Loongson processors |
| `oxideterm-agent-aarch64-android` | ARM64 | Android | Termux users |
| `oxideterm-agent-x86_64-freebsd` | x86_64 | FreeBSD | FreeBSD servers |

## Bundled Architectures (auto-deployed)

The following architectures are bundled with OxideTerm and deployed automatically:

- `x86_64-unknown-linux-musl` (x86_64 Linux)
- `aarch64-unknown-linux-musl` (ARM64 Linux)

## Notes

- All Linux binaries are statically linked (musl libc) for maximum compatibility
- File watching on non-Linux systems uses polling fallback (no inotify)
- Android binary is intended for Termux environments

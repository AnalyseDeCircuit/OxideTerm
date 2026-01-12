# ⚡ OxideTerm

A modern, high-performance SSH terminal client built with Rust and Tauri.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)

## ✨ Features

- **Zero Latency** - WebSocket bridging bypasses Tauri IPC for real-time terminal interaction
- **GPU Accelerated** - WebGL rendering via xterm.js handles massive log outputs smoothly
- **Secure** - Pure Rust SSH implementation with no C dependencies
- **Modern UI** - Catppuccin Mocha theme with Radix UI primitives
- **Multi-Session** - Drag-and-drop tab management with status indicators
- **SFTP Support** - Integrated file browser in bottom panel
- **Port Forwarding** - Easy local/remote port forwarding
- **Command Palette** - Quick access to all features (⌘K)

## 🏗️ Architecture

OxideTerm uses a **dual-plane architecture** separating:

- **Data Plane**: Direct WebSocket connection between xterm.js and SSH session (binary streaming)
- **Control Plane**: Tauri commands for connection management, authentication, and settings

```
┌─────────────┐     WebSocket      ┌─────────────┐     SSH      ┌─────────────┐
│   xterm.js  │ ◄───(binary)────► │   Rust WS   │ ◄──────────► │   Server    │
│  (Frontend) │                    │   Bridge    │              │  (Remote)   │
└─────────────┘                    └─────────────┘              └─────────────┘
       │                                  │
       │  Tauri IPC (Commands)            │
       └──────────────────────────────────┘
              (Control Plane Only)
```

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| App Shell | Tauri 2.0 |
| SSH Protocol | russh |
| Async Runtime | Tokio |
| WebSocket | tokio-tungstenite |
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS 4 + CSS Variables |
| UI Primitives | Radix UI + CVA |
| Animation | Framer Motion |
| Terminal | xterm.js + WebGL Addon |
| State | Zustand |
| Command Palette | cmdk |

## 🚀 Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [Node.js](https://nodejs.org/) (v18+)
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run tauri dev
```

### Build

```bash
# Build for production
npm run tauri build
```

## 📁 Project Structure

```
oxideterm/
├── src/                     # Frontend (React/TypeScript)
│   ├── components/
│   │   ├── ui/              # Atomic UI components (Button, Input, Dialog...)
│   │   ├── layout/          # Layout components (AppShell, Sidebar, TabBar...)
│   │   ├── connections/     # Connection management
│   │   ├── terminal/        # Terminal view
│   │   ├── settings/        # Settings panel
│   │   └── portforward/     # Port forwarding
│   ├── store/               # Zustand state management
│   ├── lib/                 # Utilities (cn, animations)
│   ├── styles/              # CSS variables & globals
│   └── types/               # TypeScript types
├── src-tauri/               # Backend (Rust)
│   └── src/
│       ├── ssh/             # SSH client implementation
│       ├── bridge/          # WebSocket bridge server
│       ├── session/         # Session management & health
│       ├── forwarding/      # Port forwarding
│       ├── sftp/            # SFTP implementation
│       └── commands/        # Tauri commands (v2 API)
├── docs/                    # Documentation
└── package.json
```

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` | Open Command Palette |
| `⌘B` | Toggle Sidebar |
| `⌘J` | Toggle Bottom Panel |
| `⌘N` / `⌘T` | New Connection |
| `⌘W` | Close Tab |
| `⌘,` | Open Settings |
| `⌘1-9` | Switch to Tab N |

## 📝 License

CC-BY NC 4.0

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

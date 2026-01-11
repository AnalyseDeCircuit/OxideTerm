# ⚡ OxideTerm

A modern, high-performance SSH terminal client built with Rust and Tauri.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)

## ✨ Features

- **Zero Latency** - WebSocket bridging bypasses Tauri IPC for real-time terminal interaction
- **GPU Accelerated** - WebGL rendering via xterm.js handles massive log outputs smoothly
- **Secure** - Pure Rust SSH implementation with no C dependencies
- **Modern UI** - React + Tailwind CSS for a beautiful, dark-mode interface
- **Multi-Session** - Manage multiple SSH connections in tabs

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
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS |
| Terminal | xterm.js + WebGL Addon |
| State | Zustand |

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
│   ├── components/          # UI components
│   ├── store/               # Zustand state management
│   └── types/               # TypeScript types
├── src-tauri/               # Backend (Rust)
│   └── src/
│       ├── ssh/             # SSH client implementation
│       ├── bridge/          # WebSocket bridge server
│       └── commands/        # Tauri commands
└── package.json
```

## 📝 License

CC-BY NC 4.0

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

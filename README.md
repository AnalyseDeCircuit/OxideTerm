<p align="center">
  <img src="public/icons/icon.png" alt="OxideTerm" width="128" height="128">
</p>

<h1 align="center">⚡ OxideTerm</h1>

<p align="center">
  <strong>高性能、现代化的 SSH 终端客户端</strong>
  <br>
  <em>使用 Rust + Tauri 构建，为开发者和运维工程师打造</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue" alt="Platform">
  <img src="https://img.shields.io/badge/license-CC--BY--NC--4.0-green" alt="License">
  <img src="https://img.shields.io/badge/rust-1.75+-orange" alt="Rust">
  <img src="https://img.shields.io/badge/tauri-2.0-purple" alt="Tauri">
</p>

---

## ✨ 特性

### 🚀 极致性能
- **零延迟数据传输** - WebSocket 直连绕过 Tauri IPC，实现真正的实时终端交互
- **GPU 加速渲染** - 基于 xterm.js WebGL 插件，轻松处理海量日志输出
- **内存高效** - Rust 编写的后端，无 GC 开销，内存占用极低

### 🔐 安全可靠
- **纯 Rust SSH 实现** - 基于 russh，无 C 依赖，杜绝内存安全漏洞
- **系统密钥链集成** - 密码安全存储于 macOS Keychain / Windows Credential Manager
- **自动重连** - 网络波动时智能重连，会话不丢失

### 🎨 现代界面
- **深色主题** - Catppuccin Mocha 配色，护眼舒适
- **多标签管理** - 拖拽排序、右键菜单、快速切换
- **命令面板** - `⌘K` 快速访问所有功能

### 📂 SFTP 文件管理
- **双窗格浏览器** - 本地/远程文件并排显示
- **拖拽传输** - 直接拖拽上传下载
- **批量操作** - 多选删除、重命名、新建文件夹
- **智能预览** - 代码高亮、图片/视频/PDF 预览、Hex 视图

### 🔀 端口转发
- **本地转发** - Local Port Forwarding (`-L`)
- **远程转发** - Remote Port Forwarding (`-R`)
- **动态代理** - SOCKS5 Dynamic Forwarding (`-D`)
- **实时统计** - 连接数、流量统计、运行时间

---

## 🏗️ 架构

OxideTerm 采用**双平面架构**，将数据流与控制流分离：

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │   xterm.js  │    │    SFTP     │    │  Forwards   │          │
│  │  (Terminal) │    │  (Browser)  │    │  (Manager)  │          │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘          │
│         │                  │                  │                  │
│         │ WebSocket        │ Tauri IPC        │ Tauri IPC        │
│         │ (Binary)         │ (Commands)       │ (Commands)       │
└─────────┼──────────────────┼──────────────────┼──────────────────┘
          │                  │                  │
┌─────────┼──────────────────┼──────────────────┼──────────────────┐
│         ▼                  ▼                  ▼                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │  WS Bridge  │    │    SFTP     │    │ Forwarding  │          │
│  │   Server    │    │   Session   │    │   Manager   │          │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘          │
│         │                  │                  │                  │
│         └──────────────────┼──────────────────┘                  │
│                            ▼                                     │
│                    ┌─────────────┐                               │
│                    │ SSH Session │                               │
│                    │  (russh)    │                               │
│                    └──────┬──────┘                               │
│                           │                                      │
│                    Backend (Rust/Tauri)                          │
└───────────────────────────┼──────────────────────────────────────┘
                            │
                            ▼
                    ┌─────────────┐
                    │ SSH Server  │
                    │  (Remote)   │
                    └─────────────┘
```

**数据平面 (Data Plane)**
- 终端 I/O 通过 WebSocket 直连，二进制流无解析开销
- 心跳检测保持连接活跃

**控制平面 (Control Plane)**
- Tauri Commands 处理连接管理、文件操作、配置等
- 事件系统用于状态同步

---

## 🛠️ 技术栈

| 组件 | 技术 |
|------|------|
| **应用框架** | Tauri 2.0 |
| **SSH 协议** | russh (纯 Rust) |
| **异步运行时** | Tokio |
| **WebSocket** | tokio-tungstenite |
| **前端框架** | React 19 + TypeScript |
| **样式方案** | Tailwind CSS 4 |
| **UI 组件** | Radix UI + CVA |
| **终端渲染** | xterm.js + WebGL Addon |
| **状态管理** | Zustand |
| **构建工具** | Vite |

---

## 🚀 快速开始

### 系统要求

- [Rust](https://rustup.rs/) 1.75+
- [Node.js](https://nodejs.org/) 18+
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

### 开发

```bash
# 克隆仓库
git clone https://github.com/AnalyseDeCircuit/OxideTerm.git
cd OxideTerm

# 安装依赖
npm install

# 启动开发服务器
npm run tauri dev
```

### 构建

```bash
# 构建生产版本
npm run tauri build
```

构建产物位于 `src-tauri/target/release/bundle/`

---

## 📁 项目结构

```
OxideTerm/
├── src/                        # 前端 (React/TypeScript)
│   ├── components/
│   │   ├── ui/                 # 原子 UI 组件
│   │   ├── layout/             # 布局组件 (Sidebar, TabBar)
│   │   ├── terminal/           # 终端视图
│   │   ├── sftp/               # SFTP 文件浏览器
│   │   ├── forwards/           # 端口转发管理
│   │   └── modals/             # 弹窗组件
│   ├── store/                  # Zustand 状态管理
│   ├── lib/                    # 工具函数 & API
│   ├── hooks/                  # React Hooks
│   └── types/                  # TypeScript 类型定义
│
├── src-tauri/                  # 后端 (Rust)
│   └── src/
│       ├── ssh/                # SSH 客户端实现
│       ├── bridge/             # WebSocket 桥接服务器
│       ├── session/            # 会话管理 & 健康检查
│       ├── sftp/               # SFTP 实现
│       ├── forwarding/         # 端口转发
│       ├── config/             # 配置 & 密钥链
│       └── commands/           # Tauri 命令
│
├── docs/                       # 文档
│   ├── ARCHITECTURE.md         # 架构设计
│   ├── PROTOCOL.md             # 协议规范
│   ├── FRONTEND_SPEC.md        # 前端规格
│   └── DEVELOPMENT.md          # 开发指南
│
└── public/                     # 静态资源
    ├── fonts/                  # 字体文件
    └── icons/                  # 应用图标
```

---

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `⌘K` | 打开命令面板 |
| `⌘B` | 切换侧边栏 |
| `⌘N` | 新建连接 |
| `⌘W` | 关闭当前标签 |
| `⌘,` | 打开设置 |
| `⌘1-9` | 切换到第 N 个标签 |
| `⌘⇧[` / `⌘⇧]` | 切换上/下一个标签 |

---

## 📖 文档

详细文档请查看 [docs/](docs/) 目录：

- [架构设计](docs/ARCHITECTURE.md) - 系统架构与设计决策
- [协议规范](docs/PROTOCOL.md) - 前后端通信协议
- [前端规格](docs/FRONTEND_SPEC.md) - UI/UX 规格说明
- [开发指南](docs/DEVELOPMENT.md) - 开发环境搭建与贡献指南

---

## 📝 许可证

本项目采用 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) 许可证。

**您可以自由地：**
- ✅ 复制、分发、展示和演绎本作品
- ✅ 修改和构建衍生作品

**但须遵守：**
- ℹ️ **署名** — 您必须注明原作者并提供许可证链接
- 🚫 **非商业性使用** — 您不得将本作品用于商业目的

如需商业使用授权，请联系作者。

---

## 🤝 贡献

欢迎贡献代码！请阅读 [开发指南](docs/DEVELOPMENT.md) 了解如何参与。

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

---

<p align="center">
  <sub>Built with ❤️ using Rust and Tauri</sub>
</p>

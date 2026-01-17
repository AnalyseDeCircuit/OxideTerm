<p align="center">
  <img src="src-tauri/icons/icon.ico" alt="OxideTerm" width="128" height="128">
</p>

<h1 align="center">⚡ OxideTerm</h1>

<p align="center">
  <strong>高性能、现代化的 SSH 终端客户端</strong>
  <br>
  <em>使用 Rust + Tauri 构建，为开发者和运维工程师打造</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue" alt="Platform">
  <img src="https://img.shields.io/badge/license-PolyForm%20Noncommercial-blueviolet" alt="License">
  <img src="https://img.shields.io/badge/rust-1.75+-orange" alt="Rust">
  <img src="https://img.shields.io/badge/tauri-2.0-purple" alt="Tauri">
</p>

---

## ✨ 特性

### 🚀 极致性能
- **零延迟数据传输** - WebSocket 直连绕过 Tauri IPC，实现真正的实时终端交互
- **GPU 加速渲染** - 基于 xterm.js WebGL 插件，轻松处理海量日志输出
- **内存高效** - Rust 编写的后端，无 GC 开销，内存占用极低
- **并发连接** - 多会话并发管理，每个会话独立线程池

### 🔐 安全与认证
- **纯 Rust SSH 实现** - 基于 russh，无 C 依赖，杜绝内存安全漏洞
- **多种认证方式**
  - 🔑 密码认证 - 系统密钥链安全存储
  - 🗝️ 密钥认证 - 支持 RSA/Ed25519/ECDSA
  - 🔐 默认密钥 - 自动检测 `~/.ssh/id_*` 密钥
  - 🤖 SSH Agent - UI 支持，核心实现计划中 ([详情](docs/SSH_AGENT_STATUS.md))
- **跳板机支持** - 无限多跳 ProxyJump，支持 HPC 环境
- **自动重连** - 网络波动时智能重连，会话不丢失
- **Known Hosts** - SSH 主机密钥验证与管理

### 🎨 现代界面
- **主题系统** - 多款内置主题，支持自定义
- **多标签管理** - 拖拽排序、右键菜单、快速切换
- **侧边栏** - 会话管理、分组组织
- **响应式设计** - 适配各种屏幕尺寸

### 📂 SFTP 文件管理
- **双窗格浏览器** - 本地/远程文件并排显示
- **拖拽传输** - 直接拖拽上传下载，支持多文件
- **批量操作** - 多选删除、重命名、新建文件夹
- **智能预览**
  - 🎨 图片预览（JPEG/PNG/GIF/WebP）
  - 🎬 视频预览（MP4/WebM）
  - 🎵 音频预览（MP3/WAV/OGG）
  - 📄 PDF 文档预览
  - 💻 代码（100+ 语言）
  - 🔍 Hex 查看器（二进制文件）
- **进度追踪** - 实时传输速度、进度条、ETA

### 🔀 端口转发
- **本地转发** - Local Port Forwarding (`-L`)
- **远程转发** - Remote Port Forwarding (`-R`)
- **动态代理** - SOCKS5 Dynamic Forwarding (`-D`)
- **持久化配置** - 保存常用转发规则，自动启动
- **健康检查** - 端口可用性检测，避免端口冲突
- **实时统计** - 连接数、流量统计、运行时间

### 📦 配置管理
- **.oxide 文件** - 加密导出/导入连接配置
  - AES-256-GCM 加密
  - Argon2 密钥派生
  - 完整性校验（SHA-256）
  - 密码强度验证
- **系统集成** - 密钥链存储（macOS Keychain / Windows Credential Manager）
- **SSH Config** - 解析 `~/.ssh/config`，导入现有配置
- **分组管理** - 按项目/环境组织连接

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
│         │         ┌────────┴────────┐         │                  │
│         │         │  ProxyJump      │         │                  │
│         │         │  (Multi-hop)    │         │                  │
│         │         └────────┬────────┘         │                  │
│         └──────────────────┼──────────────────┘                  │
│                            ▼                                     │
│                    ┌─────────────┐                               │
│                    │ SSH Session │                               │
│                    │   (russh)   │                               │
│                    └──────┬──────┘                               │
│                           │                                      │
│                    Backend (Rust/Tauri)                          │
└───────────────────────────┼──────────────────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │  Jump1 → Jump2 → Target │
              │     (SSH Servers)       │
              └─────────────────────────┘
```

### 核心特点

**数据平面 (Data Plane)**
- 终端 I/O 通过 WebSocket 直连，二进制流无解析开销
- 自定义二进制协议：`[Type:1][Length:4][Payload:n]`
- 心跳检测保持连接活跃（30秒间隔）
- 背压控制防止内存溢出
- `⌘F` / `Ctrl+F` 终端输出搜索

**控制平面 (Control Plane)**
- Tauri Commands 处理连接管理、文件操作、配置等
- 事件系统用于状态同步（重连、健康检查）
- JSON-RPC 风格的命令调用

**SSH 连接层**
- 支持直连和多跳 ProxyJump
- 使用 `direct-tcpip` 通道实现 SSH-over-SSH
- 零拷贝传输，内存高效

---

## 🛠️ 技术栈

| 组件 | 技术 |
|------|------|
| **应用框架** | Tauri 2.0 |
| **SSH 协议** | russh 0.48 (纯 Rust) |
| **SFTP 协议** | russh-sftp 2.0 |
| **异步运行时** | Tokio (full features) |
| **WebSocket** | tokio-tungstenite 0.24 |
| **前端框架** | React 19 + TypeScript |
| **样式方案** | Tailwind CSS 4 (CSS-first) |
| **UI 组件** | Radix UI + CVA |
| **终端渲染** | xterm.js 5 + WebGL Addon |
| **状态管理** | Zustand |
| **构建工具** | Vite 6 |
| **加密库** | ChaCha20-Poly1305, Argon2 |
| **持久化** | redb (嵌入式数据库) |

---

## 🚀 快速开始

### 系统要求

- [Rust](https://rustup.rs/) 1.75+
- [Node.js](https://nodejs.org/) 18+
- [Tauri 先决条件](https://v2.tauri.app/start/prerequisites/)

### 开发

```bash
# 克隆仓库
git clone https://github.com/AnalyseDeCircuit/OxideTerm.git
cd OxideTerm

# 安装依赖
npm install

# 启动开发服务器（完整栈）
npm run tauri dev

# 仅前端开发（需要配置 mock）
npm run dev
```

### 构建

```bash
# 构建生产版本
npm run tauri build

# 仅构建前端
npm run build

# Rust 类型检查（快速）
cd src-tauri && cargo check

# Rust 测试
cd src-tauri && cargo test

# TypeScript 类型检查
tsc --noEmit
```

构建产物位于 `src-tauri/target/release/bundle/`

---

## 📁 项目结构

```
OxideTerm/
├── src/                        # 前端 (React/TypeScript)
│   ├── components/
│   │   ├── ui/                 # 原子 UI 组件 (Radix UI)
│   │   ├── layout/             # 布局组件 (Sidebar, TabBar, AppLayout)
│   │   ├── terminal/           # 终端视图 (xterm.js 集成)
│   │   ├── sftp/               # SFTP 文件浏览器
│   │   ├── forwards/           # 端口转发管理界面
│   │   ├── modals/             # 弹窗组件 (连接、设置、导入导出)
│   │   └── settings/           # 设置面板
│   ├── store/                  # Zustand 状态管理
│   │   ├── appStore.ts         # 全局应用状态
│   │   └── transferStore.ts    # SFTP 传输状态
│   ├── lib/                    # 工具函数 & API
│   │   ├── api.ts              # Tauri 命令封装
│   │   ├── themeManager.ts     # 主题管理
│   │   └── utils.ts            # 通用工具
│   ├── hooks/                  # React Hooks
│   │   ├── useToast.ts         # Toast 通知
│   │   ├── useReconnectEvents.ts  # 重连事件监听
│   │   └── useNetworkStatus.ts    # 网络状态
│   └── types/                  # TypeScript 类型定义
│       └── index.ts            # 所有类型导出
│
├── src-tauri/                  # 后端 (Rust)
│   └── src/
│       ├── ssh/                # SSH 客户端实现
│       │   ├── client.rs       # SSH 连接管理
│       │   ├── proxy.rs        # ProxyJump 多跳实现
│       │   ├── agent.rs        # SSH Agent 支持（规划中）
│       │   ├── session.rs      # 会话抽象
│       │   ├── config.rs       # SSH 配置解析
│       │   └── known_hosts.rs  # 主机密钥验证
│       ├── bridge/             # WebSocket 桥接服务器
│       │   ├── server.rs       # WS 服务器实现
│       │   └── protocol.rs     # 二进制协议定义
│       ├── session/            # 会话管理
│       │   ├── manager.rs      # 会话生命周期
│       │   ├── health.rs       # 健康检查
│       │   └── auto_reconnect.rs  # 自动重连
│       ├── sftp/               # SFTP 实现
│       │   ├── client.rs       # SFTP 客户端
│       │   ├── preview.rs      # 文件预览
│       │   └── transfer.rs     # 传输管理
│       ├── forwarding/         # 端口转发
│       │   ├── manager.rs      # 转发管理器
│       │   ├── local.rs        # 本地转发
│       │   ├── remote.rs       # 远程转发
│       │   └── dynamic.rs      # 动态代理
│       ├── config/             # 配置管理
│       │   ├── manager.rs      # 配置存储
│       │   ├── keychain.rs     # 系统密钥链集成
│       │   └── ssh_config.rs   # SSH config 解析
│       ├── oxide_file/         # .oxide 文件格式
│       │   ├── format.rs       # 文件格式定义
│       │   ├── crypto.rs       # 加密实现
│       │   └── error.rs        # 错误类型
│       ├── commands/           # Tauri 命令
│       │   ├── connect_v2.rs   # 连接命令
│       │   ├── sftp.rs         # SFTP 命令
│       │   ├── forwarding.rs   # 转发命令
│       │   ├── config.rs       # 配置命令
│       │   ├── oxide_export.rs # 导出命令
│       │   └── oxide_import.rs # 导入命令
│       └── state/              # 全局状态
│           └── app_state.rs    # 应用状态管理
│
├── docs/                       # 文档
│   ├── ARCHITECTURE.md         # 架构设计
│   ├── PROTOCOL.md             # 协议规范
│   ├── SFTP.md                 # SFTP 功能文档
│   ├── PORT_FORWARDING.md      # 端口转发文档
│   ├── SSH_AGENT_STATUS.md     # SSH Agent 状态
│   └── DEVELOPMENT.md          # 开发指南
│
├── public/                     # 静态资源
│   └── fonts/                  # Nerd Fonts
│       ├── JetBrainsMono/
│       ├── Meslo/
│       └── Tinos/
└──
```

---

## 🔒 安全考虑

### 密码存储
- 密码通过系统密钥链存储，不以明文保存
- macOS: Keychain Access
- Windows: Credential Manager  
- Linux: libsecret (GNOME Keyring)

### SSH 主机密钥
- 首次连接验证主机密钥指纹
- 存储于 `~/.ssh/known_hosts`
- 支持主机密钥更新确认

### .oxide 文件加密
- AES-256-GCM 加密算法
- Argon2id 密钥派生函数（内存硬化）
- 密码强度验证：至少 12 字符，包含大小写、数字、特殊字符
- SHA-256 完整性校验

### 网络安全
- 所有 SSH 连接使用加密通道
- WebSocket 连接使用一次性 token 认证
- 无明文密码传输

---

## 📖 文档

详细文档请查看 [docs/](docs/) 目录：

- **[架构设计](docs/ARCHITECTURE.md)** - 系统架构与设计决策
- **[协议规范](docs/PROTOCOL.md)** - WebSocket 二进制协议
- **[SFTP 功能](docs/SFTP.md)** - 文件管理功能说明
- **[端口转发](docs/PORT_FORWARDING.md)** - 转发配置指南
- **[SSH Agent 状态](docs/SSH_AGENT_STATUS.md)** - Agent 认证实现状态
- **[开发指南](docs/DEVELOPMENT.md)** - 开发环境与贡献指南

---

## 🗺️ 路线图

### ✅ 已完成
- [x] 基础 SSH 连接与终端
- [x] 多标签管理
- [x] SFTP 文件浏览与传输
- [x] 端口转发（本地/远程/动态）
- [x] 跳板机支持（无限多跳）
- [x] 自动重连机制
- [x] 主题系统
- [x] .oxide 文件导入导出
- [x] SSH Config 解析
- [x] Known Hosts 管理

### 🚧 进行中
- [ ] SSH Agent 认证（UI 已完成，核心实现待 russh 库更新）
- [ ] 命令面板 (`⌘K`)
- [ ] 会话搜索与过滤

### 📋 计划中
- [ ] **全局快捷键系统**
  - `⌘N` / `Ctrl+N` - 新建连接
  - `⌘B` / `Ctrl+B` - 切换侧边栏
  - `⌘W` / `Ctrl+W` - 关闭当前标签
  - `⌘,` / `Ctrl+,` - 打开设置
  - `⌘1-9` / `Ctrl+1-9` - 切换到第 N 个标签
  - `⌘K` / `Ctrl+K` - 命令面板
- [ ] SSH Agent 转发（Agent Forwarding）
- [ ] X11 转发
- [ ] 会话录制与回放
- [ ] 脚本自动化
- [ ] 终端分屏
- [ ] SSH 隧道持久化
- [ ] 2FA 支持
- [ ] 性能分析工具

---

## 📝 许可证

本项目采用 **PolyForm Noncommercial 1.0.0** 协议。

本项目的当前及历史版本均建议在 PolyForm Noncommercial 协议下使用，原 CC 授权不再维护。

完整协议文本请参见：
https://polyformproject.org/licenses/noncommercial/1.0.0/

如需商业使用授权，请联系作者。

⚖️ 法律声明：协议变更与追溯效力 (Legal Notice: Relicensing & Retroactivity)
致所有使用者（尤其是商业实体）：

协议变更： 本项目已正式从 CC BY-NC 4.0 迁移至 PolyForm Noncommercial License 1.0.0。

追溯声明： 作为本项目的唯一著作权人，我在此声明：本项目的所有历史提交（Commits）、分支（Branches）及过往发布版本（Releases），现在均统一受 PolyForm Noncommercial License 1.0.0 约束。 3. 专利防御（核弹条款）： 本协议包含明确的专利撤销条款。任何尝试利用本项目（无论新旧版本）进行专利诉讼或商业牟利的实体，其对本项目所有代码的授权将自动、立即且永久终止。

禁止商业白嫖： - 如果您是个人、学生或非营利组织，请继续享受开源。

如果您代表商业公司或盈利性组织： 严禁以任何形式（包括但不限于直接运行、动态/静态链接、逻辑移植、算法参考）使用本项目任何版本的代码。

任何在未经书面商业授权的情况下，于商业环境中使用本项目历史 Commit 的行为，均将被视为恶意规避作者的专利保护策略，并面临法律起诉及侵权索赔。

警告： 我们的会追踪代码指纹。不要尝试翻阅 Git 历史来寻找“旧版授权”的漏洞，那在法律上将被视为有预谋的侵权行为。
---

## 🤝 贡献

欢迎贡献代码！请阅读 [开发指南](docs/DEVELOPMENT.md) 了解如何参与。

### 贡献流程

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 遵循代码规范（参见 [AGENTS.md](AGENTS.md)）
4. 编写测试（Rust 部分）
5. 提交更改 (`git commit -m 'Add amazing feature'`)
6. 推送到分支 (`git push origin feature/amazing-feature`)
7. 创建 Pull Request

### 代码规范

- **Rust**: `cargo fmt` + `cargo clippy`
- **TypeScript**: Prettier + ESLint（遵循 Airbnb 规范）
- **Git**: 使用常规提交（Conventional Commits）

---

## � 未来计划 (Future Plans)

| 功能 | 描述 | 状态 |
|------|------|------|
| **SSH Agent 支持** | 完整的 SSH Agent 协议实现 | 🔄 规划中 |
| **重连时恢复跳板机链** | 断线重连时自动恢复 proxy_chain 配置 | 📋 待实现 |
| **终端缓冲持久化** | 会话关闭后保留滚动历史 | 🔄 规划中 |
| **SSH Config 双向同步** | 支持写入 `~/.ssh/config` | 📋 待实现 |
| **远程开发集成** | VS Code Remote SSH 风格的文件编辑 | 🔄 规划中 |
| **审计功能** | 审计用户操作 | 🔄 规划中 |
---

## �🙏 致谢

特别感谢以下开源项目：

- [russh](https://github.com/warp-tech/russh) - 纯 Rust SSH 实现
- [Tauri](https://tauri.app/) - 跨平台应用框架
- [xterm.js](https://xtermjs.org/) - Web 终端模拟器
- [Radix UI](https://www.radix-ui.com/) - 无障碍 UI 组件
- [Catppuccin](https://github.com/catppuccin/catppuccin) - 美观的配色方案

---

## 📧 联系方式

- **问题反馈**: [GitHub Issues](https://github.com/AnalyseDeCircuit/OxideTerm/issues)
- **功能建议**: [GitHub Discussions](https://github.com/AnalyseDeCircuit/OxideTerm/discussions)
- **邮件**: [待补充]

---

<p align="center">
  <sub>Built with ❤️ using Rust and Tauri</sub>
</p>

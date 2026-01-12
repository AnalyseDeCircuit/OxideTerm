# OxideTerm 前端功能规格

> 前端重建参考文档。描述所有需要实现的功能和与后端的交互接口。

## 一、技术栈

| 层级 | 推荐技术 |
|------|---------|
| 框架 | React 19, TypeScript, Vite |
| 状态 | Zustand |
| 样式 | Tailwind CSS 4 |
| 终端 | xterm.js + WebGL/Fit/Search 插件 |
| 动画 | Framer Motion (可选) |

---

## 二、应用布局

采用**标签页视图**架构，每个功能模块独立页面：

```
┌──────────────────────────────────────────────────────────┐
│ [TitleBar - 窗口拖拽区 + 交通灯]                          │
├────────────┬─────────────────────────────────────────────┤
│            │ [TabBar] lipsc@server1 ✕ | lipsc@server2 ✕  │
│  Sidebar   ├─────────────────────────────────────────────┤
│            │                                             │
│ ┌────────┐ │                                             │
│ │Sessions│ │           [Terminal / SFTP / Forwards]      │
│ └────────┘ │                                             │
│ ┌────────┐ │              根据标签类型显示不同内容         │
│ │  SFTP  │ │                                             │
│ └────────┘ │                                             │
│ ┌────────┐ │                                             │
│ │Forwards│ │                                             │
│ └────────┘ │                                             │
│            │                                             │
│ [Settings] │                                             │
└────────────┴─────────────────────────────────────────────┘
```

### 标签类型

| 类型 | 图标 | 内容 |
|------|------|------|
| `terminal` | `>_` | xterm.js 终端 |
| `sftp` | `📁` | 文件浏览器 (绑定某个 session) |
| `forwards` | `🔀` | 端口转发管理 (绑定某个 session) |

### 侧边栏结构

```
Sidebar
├── Sessions (会话列表)
│   ├── + New Connection
│   ├── Recent
│   │   └── server1, server2...
│   └── Groups
│       ├── Production
│       └── Development
├── SFTP (快捷入口)
│   └── 点击已连接会话 → 打开 SFTP 标签
├── Port Forwards (快捷入口)
│   └── 点击已连接会话 → 打开转发标签
└── Settings (底部固定)
```

### 新建连接弹窗 (Modal)

点击 "New Connection" 弹出模态框：

```
┌─────────────────────────────────────────────┐
│  New Connection                         ✕   │
├─────────────────────────────────────────────┤
│                                             │
│  Name (可选)                                │
│  ┌─────────────────────────────────────┐   │
│  │ My Server                           │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Host *                        Port         │
│  ┌─────────────────────────┐ ┌───────┐     │
│  │ 192.168.1.100           │ │ 22    │     │
│  └─────────────────────────┘ └───────┘     │
│                                             │
│  Username *                                 │
│  ┌─────────────────────────────────────┐   │
│  │ root                                │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Authentication                             │
│  ○ Password  ○ SSH Key  ○ Default Key      │
│                                             │
│  [Password 选中时显示]                       │
│  Password                                   │
│  ┌─────────────────────────────────────┐   │
│  │ ••••••••                            │   │
│  └─────────────────────────────────────┘   │
│  ☑ Save password to keychain               │
│                                             │
│  [SSH Key 选中时显示]                        │
│  Key File                                   │
│  ┌─────────────────────────────┐ [Browse]  │
│  │ ~/.ssh/id_ed25519           │           │
│  └─────────────────────────────┘           │
│  Passphrase (可选)                          │
│  ┌─────────────────────────────────────┐   │
│  │                                     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Group (可选)                               │
│  ┌─────────────────────────────────────┐   │
│  │ Production                     ▼    │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ─────────────────────────────────────────  │
│  ☑ Save connection for future use          │
│                                             │
│           [Cancel]    [Connect]             │
└─────────────────────────────────────────────┘
```

**交互逻辑：**
- `Connect` 按钮始终可用（验证后）
- 勾选 "Save connection" 时，连接成功后自动保存
- 支持 `Enter` 快捷键提交
- `Escape` 关闭弹窗

### 设置页面 (独立视图)

点击 Settings 打开设置页面（替换主内容区，或新标签页）：

```
┌─────────────────────────────────────────────────────────┐
│ Settings                                                │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│ ▸ Terminal   │  Terminal Settings                       │
│   Appearance │  ─────────────────────────────────────   │
│   Connections│                                          │
│   SSH Keys   │  Theme                                   │
│   About      │  ┌──────────────────────────────────┐   │
│              │  │ Dracula                       ▼  │   │
│              │  └──────────────────────────────────┘   │
│              │                                          │
│              │  Font Family                             │
│              │  ┌──────────────────────────────────┐   │
│              │  │ JetBrains Mono                ▼  │   │
│              │  └──────────────────────────────────┘   │
│              │                                          │
│              │  Font Size              Line Height      │
│              │  ┌──────────────┐      ┌────────────┐   │
│              │  │ 14        ▼  │      │ 1.2     ▼  │   │
│              │  └──────────────┘      └────────────┘   │
│              │                                          │
│              │  Cursor                                  │
│              │  ○ Block  ○ Underline  ○ Bar            │
│              │  ☑ Cursor blink                         │
│              │                                          │
│              │  Scrollback Lines                        │
│              │  ┌──────────────────────────────────┐   │
│              │  │ ────────●───────────────  10000  │   │
│              │  └──────────────────────────────────┘   │
│              │                                          │
│              │  Behavior                                │
│              │  ☑ Right-click selects word             │
│              │  ☑ Option as Meta (macOS)               │
│              │  ☐ Alt-click moves cursor               │
│              │                                          │
└──────────────┴──────────────────────────────────────────┘
```

**设置分类：**

| 分类 | 内容 |
|------|------|
| **Terminal** | 主题、字体、字号、行高、光标、滚动缓冲、行为选项 |
| **Appearance** | 应用主题(深色/浅色)、侧边栏默认状态、语言 |
| **Connections** | 默认端口、默认用户名、分组管理 |
| **SSH Keys** | 密钥列表、从 SSH Config 导入 |
| **About** | 版本信息、检查更新、开源协议 |

**Connections 页面：**

```
Connections Settings
─────────────────────────────────────

Default Port
┌──────────────────────────────────┐
│ 22                               │
└──────────────────────────────────┘

Default Username
┌──────────────────────────────────┐
│ root                             │
└──────────────────────────────────┘

Groups
┌──────────────────────────────────┐
│ Production                    ✕  │
│ Development                   ✕  │
│ Testing                       ✕  │
└──────────────────────────────────┘
[+ Add Group]

Import from SSH Config
┌──────────────────────────────────┐
│ ~/.ssh/config                    │
└──────────────────────────────────┘
[Scan & Import]
```

**SSH Keys 页面：**

```
SSH Keys
─────────────────────────────────────

Detected Keys in ~/.ssh/

┌─────────────────────────────────────────────┐
│ 🔑 id_ed25519                               │
│    ED25519 · ~/.ssh/id_ed25519              │
├─────────────────────────────────────────────┤
│ 🔑 id_rsa                                   │
│    RSA 4096 · ~/.ssh/id_rsa                 │
├─────────────────────────────────────────────┤
│ 🔑 github_key                               │
│    ED25519 · ~/.ssh/github_key              │
└─────────────────────────────────────────────┘

[Refresh]
```

### SFTP 页面 (独立标签)

点击侧边栏 SFTP 区域的已连接会话，打开 SFTP 标签。采用**双栏布局**，左侧本地、右侧远程：

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 📁 SFTP: lipsc@server1                                                      ✕   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────┐   ┌─────────────────────────────────────┐ │
│  │ 💻 Local                        │   │ 🖥️ Remote (server1)                 │ │
│  ├─────────────────────────────────┤   ├─────────────────────────────────────┤ │
│  │ /Users/dominical/Downloads      │   │ /home/lipsc                         │ │
│  │ ┌───────────────────────┐ [↑][🏠]   │ ┌─────────────────────────┐ [↑][🏠] │ │
│  │ │ /Users/dominical/Down │       │   │ │ /home/lipsc             │         │ │
│  │ └───────────────────────┘       │   │ └─────────────────────────┘         │ │
│  ├─────────────────────────────────┤   ├─────────────────────────────────────┤ │
│  │ [New Folder] [Refresh] 🔍       │   │ [New Folder] [Refresh] 🔍           │ │
│  ├─────────────────────────────────┤   ├─────────────────────────────────────┤ │
│  │ Name              Size    Mod   │   │ Name              Size    Mod       │ │
│  ├─────────────────────────────────┤   ├─────────────────────────────────────┤ │
│  │ 📁 ..             -       -     │   │ 📁 ..             -       -         │ │
│  │ 📁 Projects       -       Jan10 │   │ 📁 Documents      -       Jan10     │ │
│  │ 📁 Screenshots    -       Jan11 │   │ 📁 .config        -       Jan08     │ │
│  │ 📄 backup.zip     27.4MB  Jan09 │ → │ 📄 .bashrc        2.1KB   Jan05     │ │
│  │ 📄 notes.txt      128B    Jan12 │ ← │ 📄 data.csv       1.2MB   Jan11     │ │
│  │ 📄 config.json    2.1KB   Jan08 │   │ 📄 script.py      4.5KB   Jan12     │ │
│  │                                 │   │                                     │ │
│  │                                 │   │                                     │ │
│  └─────────────────────────────────┘   └─────────────────────────────────────┘ │
│                                                                                 │
│       ← 拖拽文件到对面栏进行上传/下载，或双击打开文件夹 →                         │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │ Transfer Queue (2 active)                                    [Pause All] [✕]││
│  ├─────────────────────────────────────────────────────────────────────────────┤│
│  │  ↓ backup.zip        45%  ████████░░░░░░░░░░  12.3/27.4 MB  2.1MB/s   [⏸][✕]││
│  │  ↑ config.json       Done ████████████████████  2.1 KB               [✓]   ││
│  │  ↓ data.csv          Pending ░░░░░░░░░░░░░░░░  0/1.2 MB              [✕]   ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**交互功能：**

| 操作 | 触发方式 |
|------|----------|
| **上传** | 从左栏拖拽文件到右栏 / 选中后按 `→` 键 |
| **下载** | 从右栏拖拽文件到左栏 / 选中后按 `←` 键 |
| 进入目录 | 双击文件夹 |
| 返回上级 | 双击 `..` 或点击 `↑` 按钮 |
| 回到 Home | 点击 `🏠` 按钮 |
| 预览文件 | 双击文件（文本/图片） |
| 重命名 | 右键 → Rename / F2 |
| 删除 | 右键 → Delete / Delete 键 |
| 多选 | Ctrl/⌘ + 点击 / Shift 范围选 |
| 全选 | Ctrl/⌘ + A |

**右键菜单：**

```
┌──────────────────────┐
│ → Upload / ← Download│  (根据点击的栏位显示)
├──────────────────────┤
│ 👁️ Preview           │
│ ✏️ Rename            │
│ 📋 Copy Path         │
│ 🗑️ Delete            │
├──────────────────────┤
│ 📁 New Folder        │
│ 📄 New File          │
└──────────────────────┘
```

**传输队列说明：**

| 图标 | 含义 |
|------|------|
| ↑ | 上传 (Local → Remote) |
| ↓ | 下载 (Remote → Local) |
| ⏸ | 暂停 |
| ▶️ | 继续 |
| ✕ | 取消/移除 |
| ✓ | 完成 |

**文件预览弹窗：**

```
┌─────────────────────────────────────────────┐
│ Preview: config.json                    ✕   │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ {                                       │ │
│ │   "name": "my-app",                     │ │
│ │   "version": "1.0.0",                   │ │
│ │   "dependencies": {                     │ │
│ │     "react": "^19.0.0"                  │ │
│ │   }                                     │ │
│ │ }                                       │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│              [Download]  [Close]            │
└─────────────────────────────────────────────┘
```

### 端口转发页面 (独立标签)

点击侧边栏 Port Forwards 区域的已连接会话，打开端口转发标签：

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🔀 Port Forwards: lipsc@server1                                     ✕   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Quick Forwards                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ [🐍 Jupyter 8888]  [📊 TensorBoard 6006]  [💻 VS Code 8080]       │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  Active Forwards                                                        │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Type     Local              Remote               Status   Actions │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │  L →      localhost:8888     localhost:8888       🟢 Active  [⏹]  │ │
│  │  L →      localhost:3306     db.internal:3306     🟢 Active  [⏹]  │ │
│  │  R ←      0.0.0.0:9000       localhost:9000       🟡 Starting [⏹] │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  New Forward                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                                                                    │ │
│  │  Type                                                              │ │
│  │  ○ Local (L)  ○ Remote (R)  ○ Dynamic (SOCKS5)                    │ │
│  │                                                                    │ │
│  │  [Local 选中时]                                                    │ │
│  │  Local                              Remote                         │ │
│  │  ┌────────────┐ : ┌──────┐        ┌────────────┐ : ┌──────┐       │ │
│  │  │ localhost  │   │ 8888 │   →    │ localhost  │   │ 8888 │       │ │
│  │  └────────────┘   └──────┘        └────────────┘   └──────┘       │ │
│  │                                                                    │ │
│  │  [Remote 选中时]                                                   │ │
│  │  Remote (on server)                 Local                          │ │
│  │  ┌────────────┐ : ┌──────┐        ┌────────────┐ : ┌──────┐       │ │
│  │  │ 0.0.0.0    │   │ 9000 │   ←    │ localhost  │   │ 9000 │       │ │
│  │  └────────────┘   └──────┘        └────────────┘   └──────┘       │ │
│  │                                                                    │ │
│  │  [Dynamic 选中时]                                                  │ │
│  │  SOCKS5 Proxy Port                                                 │ │
│  │  ┌──────────────────────────────────────────┐                     │ │
│  │  │ 1080                                     │                     │ │
│  │  └──────────────────────────────────────────┘                     │ │
│  │                                                                    │ │
│  │                                        [Create Forward]            │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**转发类型说明：**

| 类型 | 方向 | 用途 | 示例 |
|------|------|------|------|
| **Local (L)** | `本地 → 远程` | 访问远程服务 | `localhost:3306 → db:3306` |
| **Remote (R)** | `远程 → 本地` | 暴露本地服务 | `server:8080 → localhost:3000` |
| **Dynamic** | SOCKS5 代理 | 全局代理 | `localhost:1080` |

**状态指示：**

| 状态 | 图标 | 含义 |
|------|------|------|
| 🟢 Active | 绿色 | 正常运行 |
| 🟡 Starting | 黄色 | 启动中 |
| 🔴 Error | 红色 | 错误 |
| ⚪ Stopped | 灰色 | 已停止 |

**Quick Forwards 快捷按钮：**

点击后自动填充常用配置：

| 按钮 | 配置 |
|------|------|
| 🐍 Jupyter | L: `localhost:8888 → localhost:8888` |
| 📊 TensorBoard | L: `localhost:6006 → localhost:6006` |
| 💻 VS Code Server | L: `localhost:8080 → localhost:8080` |

---

## 三、核心功能模块

### 3.1 SSH 连接管理

**功能：**
- 新建 SSH 连接（密码/密钥认证）
- 保存/编辑/删除连接配置
- 连接分组管理
- 从 `~/.ssh/config` 导入

**Tauri 命令：**

```typescript
// 连接控制
invoke('connect_v2', { request: ConnectRequest }): Promise<SessionInfo>
invoke('disconnect_v2', { sessionId: string }): Promise<void>
invoke('list_sessions_v2'): Promise<SessionInfo[]>
invoke('resize_session_v2', { sessionId, cols, rows }): Promise<void>

// 配置管理
invoke('get_connections'): Promise<ConnectionInfo[]>
invoke('save_connection', { request: SaveConnectionRequest }): Promise<string>
invoke('delete_connection', { id: string }): Promise<void>
invoke('get_recent_connections', { limit: number }): Promise<ConnectionInfo[]>

// SSH Config
invoke('list_ssh_config_hosts'): Promise<SshHostInfo[]>
invoke('import_ssh_host', { alias: string }): Promise<ConnectionInfo>
```

### 3.2 终端 (xterm.js)

**功能：**
- 多终端实例管理（实例池）
- WebSocket 数据流 (`ws_url` 来自 SessionInfo)
- 终端尺寸自适应
- 搜索功能
- 主题切换
- 字体/字号配置

**Wire Protocol (WebSocket 帧)：**

```typescript
// 帧格式: [1字节类型][payload]
enum MessageType {
  Data = 0x00,      // 终端数据
  Resize = 0x01,    // 尺寸变化: [cols: u16][rows: u16]
  Heartbeat = 0x02, // 心跳
  Error = 0x03,     // 错误
}
```

### 3.3 SFTP 文件管理

**功能：**
- 目录浏览和导航
- 文件上传/下载（带进度）
- 文件预览（文本/图片）
- 创建目录、删除、重命名

**Tauri 命令：**

```typescript
invoke('sftp_init', { sessionId }): Promise<void>
invoke('sftp_list_dir', { sessionId, path, filter }): Promise<FileInfo[]>
invoke('sftp_download', { sessionId, remotePath, localPath }): Promise<void>
invoke('sftp_upload', { sessionId, localPath, remotePath }): Promise<void>
invoke('sftp_mkdir', { sessionId, path }): Promise<void>
invoke('sftp_delete', { sessionId, path }): Promise<void>
invoke('sftp_rename', { sessionId, oldPath, newPath }): Promise<void>
invoke('sftp_preview', { sessionId, path }): Promise<PreviewContent>
```

**事件监听：**

```typescript
listen(`sftp:progress:${sessionId}`, (event: TransferProgress) => {})
```

### 3.4 端口转发

**功能：**
- 本地转发 (L): `local:port → remote:port`
- 远程转发 (R): `remote:port → local:port`
- 动态转发 (SOCKS5)
- 预设快捷转发 (Jupyter 8888, TensorBoard 6006)

**Tauri 命令：**

```typescript
invoke('create_port_forward', { request: ForwardRequest }): Promise<string>
invoke('stop_port_forward', { sessionId, forwardId }): Promise<void>
invoke('list_port_forwards', { sessionId }): Promise<ForwardRule[]>
```

### 3.5 连接健康监控

**功能：**
- 实时延迟显示
- 连接状态指示 (healthy/degraded/disconnected)

**Tauri 命令：**

```typescript
invoke('get_connection_health', { sessionId }): Promise<HealthMetrics>
invoke('get_all_health_status'): Promise<Record<string, HealthStatus>>
```

### 3.6 设置页面

**功能模块：**

#### 终端设置
- **外观**: 主题选择、字体、字号、行高、字间距
- **光标**: 样式(block/underline/bar)、闪烁、宽度
- **缓冲区**: scrollback 行数
- **行为**: 右键选词、macOptionIsMeta、Alt点击移动光标、响铃样式

#### 连接设置
- **分组管理**: 创建/删除连接分组
- **默认设置**: 默认端口、用户名

#### SSH 密钥管理
- **密钥列表**: 检查 `~/.ssh/` 下的密钥
- **导入**: 从 SSH config 导入

#### 外观设置
- **主题**: 应用主题切换
- **侧边栏**: 默认展开/折叠

**Tauri 命令：**

```typescript
// 分组管理
invoke('get_groups'): Promise<string[]>
invoke('create_group', { name: string }): Promise<void>
invoke('delete_group', { name: string }): Promise<void>

// SSH 密钥
invoke('check_ssh_keys'): Promise<SshKeyInfo[]>
invoke('get_ssh_config_path'): Promise<string>

// 连接配置（导入/导出功能预留）
invoke('list_ssh_config_hosts'): Promise<SshHostInfo[]>
invoke('import_ssh_host', { alias: string }): Promise<ConnectionInfo>
```

**本地存储 (localStorage/Zustand persist)：**

```typescript
// 终端配置 - 纯前端存储
interface TerminalConfig {
  // 外观
  themeId: string;
  fontFamily: string;
  fontSize: number;        // 12-24
  lineHeight: number;      // 1.0-2.0
  letterSpacing: number;   // -1 to 2
  
  // 光标
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
  cursorWidth: number;     // 1-10 (bar 模式)
  
  // 缓冲区
  scrollback: number;      // 1000-100000
  
  // 行为
  rightClickSelectsWord: boolean;
  macOptionIsMeta: boolean;
  altClickMovesCursor: boolean;
  bellStyle: 'none' | 'sound' | 'visual' | 'both';
  linkHandler: boolean;
}

// 应用设置 - 纯前端存储
interface AppSettings {
  sidebarDefaultCollapsed: boolean;
  defaultPort: number;
  defaultUsername: string;
}
```

---

## 四、数据类型

### 标签

```typescript
type TabType = 'terminal' | 'sftp' | 'forwards';

interface Tab {
  id: string;
  type: TabType;
  sessionId: string;      // 关联的会话 ID
  title: string;          // 显示标题
  icon?: string;          // 可选图标
}

// 示例:
// { id: 'tab-1', type: 'terminal', sessionId: 'sess-abc', title: 'lipsc@server1' }
// { id: 'tab-2', type: 'sftp', sessionId: 'sess-abc', title: 'SFTP: server1' }
// { id: 'tab-3', type: 'forwards', sessionId: 'sess-abc', title: 'Forwards: server1' }
```

### 会话

```typescript
type SessionState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface ConnectRequest {
  host: string;
  port: number;
  username: string;
  auth_type: 'password' | 'key' | 'default_key';
  password?: string;
  key_path?: string;
  passphrase?: string;
  cols?: number;
  rows?: number;
  name?: string;
}

interface SessionInfo {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  state: SessionState;
  error?: string;
  ws_url?: string;    // WebSocket 地址
  color: string;
  uptime_secs: number;
}
```

### 连接配置

```typescript
interface ConnectionInfo {
  id: string;
  name: string;
  group: string | null;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key' | 'agent';
  keyPath: string | null;
  lastUsedAt: string | null;
}

interface SaveConnectionRequest {
  id?: string;  // 编辑时传入
  name: string;
  group: string | null;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key' | 'agent';
  password?: string;
  keyPath?: string;
}
```

### SFTP

```typescript
type FileType = 'File' | 'Directory' | 'Symlink' | 'Unknown';

interface FileInfo {
  name: string;
  path: string;
  file_type: FileType;
  size: number;
  modified: number | null;
  permissions: string | null;
}

type PreviewContent =
  | { Text: { data: string; mime_type: string | null } }
  | { Base64: { data: string; mime_type: string | null } }
  | { TooLarge: { size: number } }
  | { Unsupported: { mime_type: string | null } };

interface TransferProgress {
  transferred: number;
  total: number;
  percentage: number;
  state: 'Pending' | 'InProgress' | 'Completed' | { Failed: string };
}
```

### 端口转发

```typescript
type ForwardType = 'local' | 'remote' | 'dynamic';

interface ForwardRequest {
  session_id: string;
  forward_type: ForwardType;
  local_host: string;
  local_port: number;
  remote_host: string;
  remote_port: number;
}

interface ForwardRule {
  id: string;
  forward_type: ForwardType;
  local_host: string;
  local_port: number;
  remote_host: string;
  remote_port: number;
  status: 'starting' | 'active' | 'stopped' | 'error';
}
```

### 健康监控

```typescript
interface HealthMetrics {
  status: 'healthy' | 'degraded' | 'unresponsive' | 'disconnected';
  latency_ms: number | null;
  last_check: number;
  uptime_secs: number;
}
```

### 终端主题

```typescript
// xterm.js ITheme 兼容
interface TerminalTheme {
  id: string;
  name: string;
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent?: string;
  selectionBackground?: string;
  selectionForeground?: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

// 内置主题
const BUILTIN_THEMES = [
  'default',      // OxideTerm 默认
  'dracula',
  'nord',
  'tokyo-night',
  'one-dark',
  'monokai',
  'catppuccin-mocha',
  'solarized-dark',
  'gruvbox-dark',
] as const;
```

### SSH 密钥

```typescript
interface SshKeyInfo {
  name: string;       // 文件名 (id_rsa, id_ed25519)
  path: string;       // 完整路径
  key_type: string;   // RSA, ED25519, ECDSA
  has_passphrase: boolean;
}
```

---

## 五、键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| ⌘/Ctrl + T | 新建连接 |
| ⌘/Ctrl + W | 关闭当前标签 |
| ⌘/Ctrl + 1-9 | 切换标签 |
| ⌘/Ctrl + Tab | 下一个标签 |
| ⌘/Ctrl + B | 切换侧边栏 |
| ⌘/Ctrl + F | 终端搜索 |
| ⌘/Ctrl + , | 设置 |

---

## 六、设计建议

### 配色
- 深色主题为主
- 建议参考: Warp, 
### 字体
- 终端: JetBrains Mono / SF Mono / Cascadia Code
- UI: Inter / SF Pro

### 动效
- 快速响应（< 150ms）
- 避免过度动画

---

## 七、状态管理建议

```typescript
// 单一 store 结构
interface AppStore {
  // 会话
  sessions: Map<string, SessionInfo>;
  
  // 标签系统
  tabs: Tab[];
  activeTabId: string | null;
  
  // UI 状态
  sidebarCollapsed: boolean;
  sidebarActiveSection: 'sessions' | 'sftp' | 'forwards';
  
  // Actions - 会话
  connect(request: ConnectRequest): Promise<string>;
  disconnect(sessionId: string): Promise<void>;
  
  // Actions - 标签
  openTerminalTab(sessionId: string): void;
  openSftpTab(sessionId: string): void;
  openForwardsTab(sessionId: string): void;
  closeTab(tabId: string): void;
  setActiveTab(tabId: string): void;
  
  // Computed
  getActiveTab(): Tab | null;
  getTabsForSession(sessionId: string): Tab[];
}
```

---

## 八、文件结构建议

```
src/
├── main.tsx              # 入口
├── App.tsx               # 根组件
├── styles.css            # 全局样式
├── components/
│   ├── layout/           # 布局组件
│   ├── terminal/         # 终端组件
│   ├── sftp/             # SFTP 组件
│   └── ui/               # 基础 UI 组件
├── hooks/                # 自定义 hooks
├── store/                # Zustand store
├── lib/                  # 工具函数
└── types/                # TypeScript 类型
```

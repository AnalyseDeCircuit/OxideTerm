# SSH Connection Pool Architecture

> **实现状态**: ✅ Phase 1 后端完成 | ✅ Phase 2 前端完成 | 兼容现有 `connect_v2`

## 概述

将 SSH 连接管理从终端界面中独立出来，形成**连接池**架构。Session、SFTP、Forwarding 变为纯前端界面，都通过共享的 `HandleController` 访问同一 SSH 连接。

## 核心设计决策

| 决策项 | 选择 | 说明 |
|--------|------|------|
| 连接管理器 | 扩展现有 `SshConnectionManager` | 复用 `ssh/manager.rs` 已有设计 |
| 空闲超时策略 | 方案 B+C | 可配置超时（默认30分钟）+ 应用退出保护 |
| 终端缓冲 | 各自独立 `ScrollBuffer` | 每个终端 Tab 独立历史记录 |

## 架构对比

### Before（当前架构）

```
┌─────────────────────────────────────────────────────────┐
│  SessionRegistry                                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │  SessionEntry                                     │  │
│  │  ├── handle_controller  ← SSH 连接（耦合）        │  │
│  │  ├── ws_port            ← WebSocket 端口          │  │
│  │  ├── scroll_buffer      ← 终端缓冲                │  │
│  │  └── order              ← Tab 顺序                │  │
│  └───────────────────────────────────────────────────┘  │
│                          │                              │
│         关闭 Tab = kill SSH 连接 = SFTP/Forwarding 失效 │
└─────────────────────────────────────────────────────────┘
```

### After（目标架构）

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  ┌─────────────────────────┐     ┌─────────────────────────────────┐   │
│  │  SshConnectionRegistry  │     │  SessionRegistry (纯 UI 状态)   │   │
│  │  ┌───────────────────┐  │     │  ┌───────────────────────────┐  │   │
│  │  │  ConnectionEntry  │  │     │  │  SessionEntry             │  │   │
│  │  │  ├── id           │  │◄────│  │  ├── connection_id ───────┼──┼───┘
│  │  │  ├── handle_ctrl  │  │     │  │  ├── ws_port              │  │
│  │  │  ├── config       │  │     │  │  ├── scroll_buffer        │  │
│  │  │  ├── ref_count    │  │     │  │  └── order                │  │
│  │  │  └── idle_timer   │  │     │  └───────────────────────────┘  │
│  │  └───────────────────┘  │     └─────────────────────────────────┘
│  └─────────────────────────┘                                           │
│           │                                                             │
│           │  共享 HandleController                                      │
│           │                                                             │
│     ┌─────┴─────┬─────────────┬─────────────┐                          │
│     ▼           ▼             ▼             ▼                          │
│  Terminal    Terminal      SFTP       Forwarding                       │
│   Tab 1       Tab 2                                                    │
│                                                                         │
│  关闭所有 Tab → 连接进入空闲 → 30分钟后才断开                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## 数据结构定义

### ConnectionEntry（SSH 连接条目）

```rust
pub struct ConnectionEntry {
    /// 连接唯一标识
    pub id: String,
    
    /// SSH Handle 控制器（共享给所有使用者）
    pub handle_controller: HandleController,
    
    /// 原始连接配置（用于重连）
    pub config: SshConnectionConfig,
    
    /// 引用计数（Terminal + SFTP + Forwarding）
    pub ref_count: AtomicUsize,
    
    /// 空闲计时器句柄（用于取消）
    pub idle_timer: Option<tokio::task::JoinHandle<()>>,
    
    /// 连接建立时间
    pub created_at: Instant,
    
    /// 最后活跃时间
    pub last_active: Instant,
    
    /// 连接状态
    pub state: ConnectionState,
}

pub enum ConnectionState {
    Active,           // 有活跃使用者
    Idle,             // 无使用者，等待超时
    Disconnecting,    // 正在断开
    Disconnected,     // 已断开
}
```

### SessionEntry（终端 UI 状态）- 瘦身版

```rust
pub struct SessionEntry {
    /// Session 唯一标识
    pub id: String,
    
    /// 关联的 SSH 连接 ID（核心变更）
    pub connection_id: String,
    
    /// WebSocket 端口
    pub ws_port: Option<u16>,
    
    /// WebSocket Token
    pub ws_token: Option<String>,
    
    /// 终端命令发送器
    pub cmd_tx: Option<mpsc::Sender<SessionCommand>>,
    
    /// 独立的滚动缓冲区
    pub scroll_buffer: Arc<ScrollBuffer>,
    
    /// Tab 顺序
    pub order: usize,
    
    /// Session 配置（终端大小等）
    pub terminal_config: TerminalConfig,
}
```

## API 设计

### Tauri Commands

| 命令 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `ssh_connect` | `SshConnectRequest` | `ConnectionId` | 仅建立 SSH 连接 |
| `ssh_disconnect` | `connection_id` | `()` | 强制断开连接 |
| `ssh_list_connections` | - | `Vec<ConnectionInfo>` | 列出所有活跃连接 |
| `create_terminal` | `connection_id, cols, rows` | `SessionInfo` | 创建终端会话 |
| `close_terminal` | `session_id` | `()` | 关闭终端（不断开连接） |
| `attach_terminal` | `connection_id` | `SessionInfo` | 重新 attach 终端 |

### 内部方法 - SshConnectionRegistry

```rust
impl SshConnectionRegistry {
    /// 创建新连接
    pub async fn connect(&self, config: SshConnectionConfig) -> Result<String, SshError>;
    
    /// 获取连接的 HandleController（增加引用计数）
    pub fn acquire(&self, connection_id: &str) -> Result<HandleController, SshError>;
    
    /// 释放引用（减少引用计数，可能触发空闲计时器）
    pub async fn release(&self, connection_id: &str);
    
    /// 强制断开连接
    pub async fn disconnect(&self, connection_id: &str);
    
    /// 检查连接是否存活
    pub fn is_alive(&self, connection_id: &str) -> bool;
    
    /// 根据配置查找已存在的连接
    pub fn find_by_config(&self, config: &SshConnectionConfig) -> Option<String>;
}
```

## 空闲超时机制

```
                    引用计数变化流程
                    
  acquire()                              release()
     │                                      │
     ▼                                      ▼
┌─────────┐                          ┌─────────────┐
│ref_count│                          │ ref_count   │
│   += 1  │                          │    -= 1     │
└────┬────┘                          └──────┬──────┘
     │                                      │
     │  if ref_count was 0                  │  if ref_count == 0
     │  ┌───────────────┐                   │  ┌────────────────────┐
     └─►│ cancel_timer()│                   └─►│ start_idle_timer() │
        │ state = Active│                      │ state = Idle       │
        └───────────────┘                      └─────────┬──────────┘
                                                         │
                                                         │ 30 min later
                                                         ▼
                                               ┌─────────────────────┐
                                               │ disconnect()        │
                                               │ state = Disconnected│
                                               │ remove from registry│
                                               └─────────────────────┘
```

### 配置项

```rust
pub struct ConnectionPoolConfig {
    /// 空闲超时时间（默认 30 分钟）
    pub idle_timeout: Duration,
    
    /// 最大连接数（0 = 无限制）
    pub max_connections: usize,
    
    /// 是否在应用退出时保护连接（graceful shutdown）
    pub protect_on_exit: bool,
}
```

## 前端状态管理

### appStore.ts 变更

```typescript
interface AppState {
  // 新增：连接管理
  connections: Map<string, ConnectionInfo>;
  
  // 瘦身：Session 仅包含 UI 状态
  sessions: Map<string, SessionInfo>;
  
  // 新增 Actions
  connectSsh: (config: SshConfig) => Promise<string>;
  disconnectSsh: (connectionId: string) => Promise<void>;
  createTerminal: (connectionId: string) => Promise<SessionInfo>;
  closeTerminal: (sessionId: string) => Promise<void>;
}

interface ConnectionInfo {
  id: string;
  host: string;
  port: number;
  username: string;
  state: 'active' | 'idle' | 'disconnecting';
  refCount: number;
  createdAt: number;
  
  // 关联的 sessions/sftp/forwards
  terminalIds: string[];
  sftpSessionId?: string;
  forwardIds: string[];
}

interface SessionInfo {
  id: string;
  connectionId: string;  // 关联到 ConnectionInfo
  wsUrl: string;
  wsToken: string;
  title: string;
}
```

## 迁移策略

### Phase 1: 后端重构（不影响前端）

1. 扩展 `SshConnectionManager` 为 `SshConnectionRegistry`
2. 实现引用计数和空闲超时机制
3. 新增 Tauri Commands（`ssh_connect`, `create_terminal` 等）
4. **保留** `connect_v2` 作为兼容层

### Phase 2: 前端适配

1. 拆分 `appStore` 的 connections 和 sessions
2. 更新 `NewConnectionModal` 使用新 API
3. 更新 `TerminalView` 使用新 API
4. 更新 SFTP/Forwarding 组件

### Phase 3: 清理

1. 移除 `connect_v2` 兼容层
2. 清理 `SessionEntry` 中的冗余字段
3. 更新文档

## 测试用例

### 核心场景

1. **基本连接复用**
   - 创建 SSH 连接 → 打开终端 → 关闭终端 → 连接仍存活 → 30分钟后断开

2. **多终端共享连接**
   - 创建连接 → 打开终端 A → 打开终端 B → 关闭 A → B 正常工作 → 关闭 B → 空闲计时开始

3. **SFTP 独立于终端**
   - 创建连接 → 打开 SFTP → 无终端情况下传输文件 → 关闭 SFTP → 空闲计时开始

4. **空闲取消**
   - 连接空闲 → 29分钟后打开新终端 → 计时器取消 → 连接继续使用

5. **强制断开**
   - 有活跃终端 → 用户强制断开 → 所有终端收到断开事件

## 文件变更清单

### 新增文件

- `src-tauri/src/ssh/connection_registry.rs` - 连接池核心实现
- `src-tauri/src/commands/ssh.rs` - 新 SSH 命令

### 修改文件

- `src-tauri/src/ssh/mod.rs` - 导出新模块
- `src-tauri/src/ssh/manager.rs` - 扩展或重构
- `src-tauri/src/session/types.rs` - SessionEntry 瘦身
- `src-tauri/src/session/registry.rs` - 移除 HandleController 管理
- `src-tauri/src/commands/connect.rs` - 重构为兼容层
- `src-tauri/src/commands/sftp.rs` - 使用新 Registry
- `src-tauri/src/commands/forwarding.rs` - 使用新 Registry
- `src-tauri/src/lib.rs` - 注册新状态和命令
- `src/store/appStore.ts` - 拆分状态
- `src/types/index.ts` - 新类型定义

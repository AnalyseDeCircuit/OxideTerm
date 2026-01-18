# OxideTerm 序列化架构

> 本文档描述了 OxideTerm 的数据序列化策略和技术选型。

## 概述

OxideTerm 使用两种序列化格式：

| 格式 | 库 | 用途 |
|------|-----|------|
| **MessagePack** | `rmp-serde` | 二进制持久化（redb、.oxide 加密负载） |
| **JSON** | `serde_json` | 人类可读配置、.oxide 明文元数据 |

## 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    OxideTerm 序列化架构                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              MessagePack (rmp-serde)                 │   │
│  │                                                      │   │
│  │  应用场景:                                           │   │
│  │  • redb 状态存储 (session, forwarding)               │   │
│  │  • SFTP 传输进度持久化                               │   │
│  │  • .oxide 文件加密负载 (仅配置数据)                  │   │
│  │  • Terminal scroll_buffer 本地持久化               │   │
│  │                                                      │   │
│  │  特性支持:                                           │   │
│  │  ✓ 二进制紧凑格式                                    │   │
│  │  ✓ #[serde(tag = "type")] 内部标签枚举              │   │
│  │  ✓ chrono::DateTime<Utc> 原生支持                   │   │
│  │  ✓ Option<T> / Vec<T> 完全兼容                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  JSON (serde_json)                   │   │
│  │                                                      │   │
│  │  应用场景:                                           │   │
│  │  • ~/.config/oxideterm/config.json (用户配置)        │   │
│  │  • .oxide 文件 metadata 段 (明文可读)                │   │
│  │                                                      │   │
│  │  选择原因:                                           │   │
│  │  ✓ 人类可编辑                                        │   │
│  │  ✓ 调试友好                                          │   │
│  │  ✓ 无需解密即可查看文件信息                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 文件详细说明

### MessagePack 序列化组件

#### 1. `src/sftp/progress.rs` - 传输进度存储

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredTransferProgress {
    pub transfer_id: String,
    pub transfer_type: TransferType,
    pub source_path: PathBuf,
    pub destination_path: PathBuf,
    pub transferred_bytes: u64,
    pub total_bytes: u64,
    pub status: TransferStatus,
    pub last_updated: DateTime<Utc>,  // rmp-serde 原生支持
    pub session_id: String,
    pub error: Option<String>,
}
```

- **存储位置**: redb 数据库
- **特殊类型**: `DateTime<Utc>`, `PathBuf`, `Option<String>`

#### 2. `src/state/session.rs` - 会话状态持久化

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedSession {
    pub id: String,
    pub config: SessionConfig,        // 包含 AuthMethod (tag枚举)
    pub created_at: DateTime<Utc>,
    pub order: usize,
    pub version: u32,
    pub terminal_buffer: Option<Vec<u8>>,
    pub buffer_config: BufferConfig,
}
```

- **存储位置**: redb 数据库
- **特殊类型**: `AuthMethod`(内部标签枚举), `DateTime<Utc>`, `Option<Vec<u8>>`

#### 3. `src/state/forwarding.rs` - 端口转发规则存储

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedForward {
    pub id: String,
    pub session_id: String,
    pub forward_type: ForwardType,
    pub rule: ForwardRule,
    pub created_at: DateTime<Utc>,
    pub auto_start: bool,
    pub version: u32,
}
```

- **存储位置**: redb 数据库
- **特殊类型**: `ForwardType`(枚举), `DateTime<Utc>`

#### 4. `src/session/scroll_buffer.rs` - 终端缓冲区

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerializedBuffer {
    pub lines: Vec<TerminalLine>,
    pub total_lines: u64,
    pub captured_at: DateTime<Utc>,
    pub max_lines: usize,
}
```

- **用途**: 会话恢复时的终端历史
- **特殊类型**: `Vec<TerminalLine>`, `DateTime<Utc>`

#### 5. `src/oxide_file/crypto.rs` - .oxide 加密负载

```rust
/// .oxide 文件是纯配置包，不包含会话数据或终端缓冲区
#[derive(Debug, Serialize, Deserialize)]
pub struct EncryptedPayload {
    pub version: u32,
    pub connections: Vec<EncryptedConnection>,
    pub checksum: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum EncryptedAuth {
    Password { password: String },
    Key { key_path: String, passphrase: Option<String> },
    Certificate { key_path: String, cert_path: String, passphrase: Option<String> },
    Agent,
}
```

- **用途**: 连接配置导出/导入的加密部分
- **设计决策**: .oxide 仅用于设备间配置迁移，不包含会话数据（终端缓冲区等）
- **特殊类型**: `EncryptedAuth`(内部标签枚举), `Option<String>`

### JSON 序列化组件

#### 1. `src/config/storage.rs` - 用户配置文件

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigFile {
    pub version: u32,
    pub connections: Vec<SavedConnection>,
    pub groups: Vec<ConnectionGroup>,
    pub settings: AppSettings,
}
```

- **文件路径**: `~/.config/oxideterm/config.json`
- **保持 JSON 原因**: 用户可能需要手动编辑配置

#### 2. `src/oxide_file/format.rs` - .oxide 文件元数据

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OxideMetadata {
    pub exported_at: DateTime<Utc>,
    pub exported_by: String,
    pub description: Option<String>,
    pub num_connections: usize,
    pub connection_names: Vec<String>,
}
```

- **用途**: .oxide 文件的明文头部
- **保持 JSON 原因**: 允许用户在不解密的情况下查看文件信息

## 带标签的枚举类型

以下枚举使用 `#[serde(tag = "type")]` 内部标签格式，rmp-serde 完全支持：

| 枚举 | 位置 | 变体 |
|------|------|------|
| `AuthMethod` | `session/types.rs` | Password, Key, Agent |
| `EncryptedAuth` | `oxide_file/format.rs` | Password, Key, Agent |
| `SavedAuth` | `config/types.rs` | Password, KeyFile, KeyReference |
| `ParsedValue` | `ssh/config.rs` | Single, Multiple |

## 技术选型理由

### 为什么选择 MessagePack (rmp-serde)？

| 对比项 | bincode (废弃) | postcard | rmp-serde |
|--------|---------------|----------|-----------|
| 维护状态 | ⚠️ RUSTSEC-2025-0141 | ✅ 活跃 | ✅ 活跃 |
| `#[serde(tag)]` | ✅ 支持 | ❌ 不支持 | ✅ 支持 |
| `DateTime<Utc>` | ✅ 支持 | ❌ 需转换 | ✅ 支持 |
| `Option<T>` | ✅ 支持 | ⚠️ 受限 | ✅ 支持 |
| 序列化大小 | 中等 | 最小 | 中等 |
| 跨语言兼容 | ❌ Rust only | ❌ Rust only | ✅ 多语言 |

**关键决策因素**:

1. **安全性**: bincode 存在已知安全漏洞 (RUSTSEC-2025-0141)
2. **功能完整性**: postcard 不支持内部标签枚举，需要大量代码重构
3. **生态兼容**: rmp-serde 与 serde 生态完全兼容，零摩擦迁移
4. **跨语言潜力**: MessagePack 是通用格式，未来可支持其他语言客户端

### 为什么配置文件保持 JSON？

1. **可编辑性**: 用户可能需要手动修改配置
2. **可调试性**: 出问题时可以直接查看文件内容
3. **版本控制友好**: diff 友好，便于跟踪配置变化

## API 参考

### 序列化

```rust
// MessagePack (使用命名字段格式，支持默认值和可选字段)
let bytes: Vec<u8> = rmp_serde::to_vec_named(&data)?;

// JSON (人类可读配置)
let json: String = serde_json::to_string_pretty(&data)?;
```

### 反序列化

```rust
// MessagePack
let data: T = rmp_serde::from_slice(&bytes)?;

// JSON  
let data: T = serde_json::from_str(&json)?;
```

### 错误处理

```rust
// MessagePack 编码错误
rmp_serde::encode::Error

// MessagePack 解码错误
rmp_serde::decode::Error

// JSON 错误
serde_json::Error
```

> **注意**: 使用 `to_vec_named` 而非 `to_vec` 是为了支持带有 `#[serde(default)]` 或 `Option<T>` 字段的结构体。
> 命名字段格式确保反序列化时字段匹配基于名称而非位置。

## 历史变更

| 版本 | 日期 | 变更 |
|------|------|------|
| v0.4.0 | 2026-01-15 | Windows 性能优化：系统定时器精度、RAF 禁用、IME 兼容；字体加载优化：预加载和加载检测 |
| v0.3.0 | 2026-01-15 | 从 bincode/postcard 迁移到 rmp-serde |
| v0.2.0 | - | 使用 bincode 进行二进制序列化 |
| v0.1.0 | - | 初始版本，全部使用 JSON |

## 相关文档

- [ARCHITECTURE.md](./ARCHITECTURE.md) - 整体架构设计
- [PORT_FORWARDING.md](./PORT_FORWARDING.md) - 端口转发实现
- [SFTP.md](./SFTP.md) - SFTP 传输协议

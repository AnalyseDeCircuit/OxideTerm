# OxideTerm 序列化架构 (v1.1.0)

> 本文档描述了 OxideTerm 的数据序列化策略和技术选型。

## 概述

OxideTerm 使用两种序列化格式：

| 格式 | 库 | 用途 |
|------|-----|------|
| **MessagePack** | `rmp-serde` | 二进制持久化（redb 嵌入式数据库、.oxide 加密负载、滚动缓冲区） |
| **JSON** | `serde_json` | 人类可读配置（~/.oxideterm/connections.json、.oxide 明文元数据） |

## 序列化架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    OxideTerm 序列化架构                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              MessagePack (rmp-serde)                 │   │
│  │                                                      │   │
│  │  应用场景:                                           │   │
│  │  • redb 嵌入式数据库 (会话恢复、端口转发规则)        │   │
│  │  • SFTP 传输进度持久化                               │   │
│  │  • .oxide 文件加密负载 (仅配置数据)                  │   │
│  │  • Terminal scroll_buffer 序列化 (100,000 行)       │   │
│  │                                                      │   │
│  │  特性支持:                                           │   │
│  │  ✓ 二进制紧凑格式 (高效存储)                         │   │
│  │  ✓ #[serde(tag = "type")] 内部标签枚举              │   │
│  │  ✓ chrono::DateTime<Utc> 原生支持                   │   │
│  │  ✓ Option<T> / Vec<T> 完全兼容                      │   │
│  │  ✓ 跨语言兼容 (未来可支持其他语言客户端)             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  JSON (serde_json)                   │   │
│  │                                                      │   │
│  │  应用场景:                                           │   │
│  │  • ~/.oxideterm/connections.json (用户配置)         │   │
│  │  • .oxide 文件 metadata 段 (明文可读)                │   │
│  │                                                      │   │
│  │  选择原因:                                           │   │
│  │  ✓ 人类可编辑 (调试友好)                             │   │
│  │  ✓ 无需解密即可查看 .oxide 文件信息                 │   │
│  │  ✓ 版本控制友好 (Git diff 可读)                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## MessagePack 序列化组件

### 1. `src/state/session.rs` - 会话恢复持久化

**用途**: 应用重启后恢复会话（不是"导出"功能）

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedSession {
    pub id: String,
    pub config: SessionConfig,        // 包含 AuthMethod (tag枚举)
    pub created_at: DateTime<Utc>,
    pub order: usize,
    pub version: u32,
    pub terminal_buffer: Option<Vec<u8>>,  // 可选的终端缓冲区
    pub buffer_config: BufferConfig,
}
```

**存储位置**: redb 嵌入式数据库 (`~/.oxideterm/state.redb`)  
**特殊类型**: `AuthMethod`(内部标签枚举), `DateTime<Utc>`, `Option<Vec<u8>>`

**重要说明**:  
- **会话恢复** ≠ **导出功能**
- `PersistedSession` 仅在本地使用，用于应用重启后恢复会话树
- 不会被导出到 `.oxide` 文件（`.oxide` 只导出连接配置）

---

### 2. `src/state/forwarding.rs` - 端口转发规则存储

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedForward {
    pub id: String,
    pub session_id: String,
    pub forward_type: ForwardType,   // Local/Remote/Dynamic
    pub rule: ForwardRule,
    pub created_at: DateTime<Utc>,
    pub auto_start: bool,
    pub version: u32,
}
```

**存储位置**: redb 嵌入式数据库  
**特殊类型**: `ForwardType`(枚举), `DateTime<Utc>`

---

### 3. `src/session/scroll_buffer.rs` - 终端滚动缓冲区

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerializedBuffer {
    pub lines: Vec<TerminalLine>,     // 最多 100,000 行
    pub total_lines: u64,
    pub captured_at: DateTime<Utc>,
    pub max_lines: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalLine {
    pub text: String,                  // ANSI codes stripped
    pub timestamp: u64,                // Unix milliseconds
}
```

**用途**: 会话恢复时的终端历史  
**特殊类型**: `Vec<TerminalLine>`, `DateTime<Utc>`

**序列化方式**:
```rust
// Save to bytes
let bytes: Vec<u8> = buffer.save_to_bytes().await?;

// Load from bytes
let buffer = ScrollBuffer::load_from_bytes(&bytes).await?;
```

---

### 4. `src/sftp/progress.rs` - 传输进度存储（计划中）

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
    pub last_updated: DateTime<Utc>,
    pub session_id: String,
    pub error: Option<String>,
}
```

**存储位置**: redb 数据库（功能计划中）  
**特殊类型**: `DateTime<Utc>`, `PathBuf`, `Option<String>`

---

### 5. `src/oxide_file/crypto.rs` - .oxide 加密负载

**重要**: `.oxide` 文件是**纯配置导出格式**，不包含：
- ❌ 会话数据（`PersistedSession`）
- ❌ 终端缓冲区（`SerializedBuffer`）
- ❌ 端口转发规则（`PersistedForward`）

仅包含：
- ✅ 连接配置（host, port, username, auth）
- ✅ ProxyJump 跳板机链路
- ✅ 连接选项（ConnectionOptions）

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct EncryptedPayload {
    pub version: u32,
    pub connections: Vec<EncryptedConnection>,  // 仅配置
    pub checksum: String,  // SHA-256 完整性校验
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedConnection {
    pub name: String,
    pub group: Option<String>,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth: EncryptedAuth,
    pub color: Option<String>,
    pub tags: Vec<String>,
    pub options: ConnectionOptions,
    pub proxy_chain: Vec<EncryptedProxyHop>,  // 跳板机链路
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

**设计决策**:  
- ✅ `.oxide` = 配置迁移工具（设备间同步）
- ❌ 不是会话备份工具（不包含运行时状态）
- ✅ 密码直接内联在加密负载中（无需系统钥匙串）

---

## JSON 序列化组件

### 1. `src/config/storage.rs` - 用户配置文件

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigFile {
    pub version: u32,
    pub connections: Vec<SavedConnection>,
    pub groups: Vec<String>,                  // 连接分组
}
```

**文件路径**: `~/.oxideterm/connections.json` (macOS/Linux) 或 `%APPDATA%\OxideTerm\connections.json` (Windows)

**保持 JSON 原因**:  
- 用户可能需要手动编辑配置
- 调试友好，出问题时可直接查看文件内容
- 版本控制友好（Git diff 可读）

**重要**: 密码不存储在此文件中，仅保存 `keychain_id` 引用！

```rust
// 示例：密码通过 keychain_id 引用
pub enum SavedAuth {
    Password {
        keychain_id: String,  // 例如: "oxideterm-a1b2c3d4-e5f6-..."
    },
    Key {
        key_path: String,
        has_passphrase: bool,
        passphrase_keychain_id: Option<String>,  // 也是引用
    },
    // ...
}
```

---

### 2. `src/oxide_file/format.rs` - .oxide 文件元数据

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OxideMetadata {
    pub exported_at: DateTime<Utc>,
    pub exported_by: String,           // "OxideTerm v1.1.0"
    pub description: Option<String>,
    pub num_connections: usize,
    pub connection_names: Vec<String>,
}
```

**用途**: .oxide 文件的**明文头部**（不加密）  
**保持 JSON 原因**: 允许用户在不解密的情况下查看文件信息

**文件结构**:
```
.oxide File Layout:
┌─────────────────────────┐
│  Header (21 bytes)       │  ← Binary: Magic + Version + Lengths
├─────────────────────────┤
│  Salt (32 bytes)         │  ← Argon2id 盐值
├─────────────────────────┤
│  Nonce (12 bytes)        │  ← ChaCha20 nonce
├─────────────────────────┤
│  Metadata (JSON)         │  ← **明文 JSON**，查看文件信息
├─────────────────────────┤
│  Encrypted Data          │  ← **MessagePack 序列化** 后加密的连接配置
├─────────────────────────┤
│  Auth Tag (16 bytes)     │  ← ChaCha20-Poly1305 认证标签
└─────────────────────────┘
```

---

## 带标签的枚举类型

以下枚举使用 `#[serde(tag = "type")]` 内部标签格式，MessagePack 完全支持：

| 枚举 | 位置 | 变体 | 用途 |
|------|------|------|------|
| `AuthMethod` | `session/types.rs` | Password, KeyFile, Agent, Certificate, KeyboardInteractive | 会话运行时认证 |
| `EncryptedAuth` | `oxide_file/format.rs` | password, key, certificate, agent | .oxide 导出格式 |
| `SavedAuth` | `config/types.rs` | Password, Key, Certificate, Agent | 本地配置中的认证（keychain引用） |
| `ForwardType` | `forwarding/mod.rs` | Local, Remote, Dynamic | 端口转发类型 |

**示例**: MessagePack 序列化的内部标签格式

```rust
// Rust 定义
#[derive(Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum EncryptedAuth {
    Password { password: String },
    Key { key_path: String, passphrase: Option<String> },
}

// MessagePack 序列化后的逻辑结构 (Map):
{
  "type": "password",
  "password": "secret123"
}

{
  "type": "key",
  "key_path": "/home/user/.ssh/id_rsa",
  "passphrase": null
}
```

---

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

1. **安全性**: bincode 存在已知安全漏洞 (RUSTSEC-2025-0141)，项目已废弃
2. **功能完整性**: postcard 不支持内部标签枚举，需要重构大量认证相关代码
3. **生态兼容**: rmp-serde 与 serde 生态完全兼容，零摩擦迁移
4. **跨语言潜力**: MessagePack 是通用格式，未来可支持其他语言客户端（例如：Python 脚本导入 .oxide 文件）

---

### 为什么配置文件保持 JSON？

1. **可编辑性**: 用户可能需要手动修改配置（例如：批量修改端口号）
2. **可调试性**: 出问题时可以直接查看文件内容
3. **版本控制友好**: Git diff 友好，便于跟踪配置变化
4. **人类可读**: `connections.json` 可以作为配置备份参考

**示例**: `connections.json` 文件片段

```json
{
  "version": 1,
  "connections": [
    {
      "id": "conn-123",
      "name": "Production Server",
      "host": "prod.example.com",
      "port": 22,
      "username": "admin",
      "auth": {
        "type": "password",
        "keychain_id": "oxideterm-a1b2c3d4-e5f6-7890-abcd"
      },
      "group": "Production",
      "options": {
        "jump_host": null,
        "local_forward": [],
        "remote_forward": [],
        "dynamic_forward": null
      }
    }
  ],
  "groups": ["Production", "Staging", "Development"]
}
```

---

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
> 命名字段格式确保反序列化时字段匹配基于名称而非位置，提供更好的向后兼容性。

---

## 数据持久化总览

| 数据类型 | 格式 | 存储位置 | 生命周期 |
|---------|------|---------|---------|
| **连接配置** | JSON | `~/.oxideterm/connections.json` | 永久（用户配置） |
| **密码/密钥口令** | 系统钥匙串 | macOS Keychain / Windows Credential / Linux libsecret | 永久 |
| **会话恢复数据** | MessagePack | `~/.oxideterm/state.redb` (redb 数据库) | 持久（应用重启后恢复） |
| **端口转发规则** | MessagePack | `~/.oxideterm/state.redb` | 持久 |
| **终端缓冲区** | MessagePack | 内存（可选序列化到 `state.redb`） | 临时（会话断开后可保存/丢弃） |
| **.oxide 导出文件** | MessagePack (加密) + JSON (元数据) | 用户指定路径 | 临时（配置迁移工具） |

---

## 历史变更

| 版本 | 日期 | 变更 |
|------|------|------|
| **v1.1.0** | 2026-01-19 | **文档重写**: 澄清 `.oxide` 文件不包含会话数据；添加本地终端和滚动缓冲区说明；更新架构图 |
| v0.4.0 | 2026-01-15 | Windows 性能优化；字体加载优化 |
| v0.3.0 | 2026-01-15 | 从 bincode/postcard 迁移到 rmp-serde |
| v0.2.0 | - | 使用 bincode 进行二进制序列化 |
| v0.1.0 | - | 初始版本，全部使用 JSON |

---

## 相关文档

- [ARCHITECTURE.md](./ARCHITECTURE.md) - 整体架构设计
- [ARCHITECTURE_v1.1.0_UPDATES.md](./ARCHITECTURE_v1.1.0_UPDATES.md) - v1.1.0 新增特性
- [PORT_FORWARDING.md](./PORT_FORWARDING.md) - 端口转发实现
- [SFTP.md](./SFTP.md) - SFTP 传输协议

---

*文档版本: v1.1.0 | 最后更新: 2026-01-19*

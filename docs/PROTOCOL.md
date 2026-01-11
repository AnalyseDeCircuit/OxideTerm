# OxideTerm Protocol Documentation

> 本文档记录前后端通信协议，避免开发时的格式不匹配问题。

## 目录

1. [Wire Protocol (WebSocket)](#wire-protocol-websocket)
2. [Tauri Commands](#tauri-commands)
3. [数据类型映射](#数据类型映射)
4. [版本迁移计划](#版本迁移计划)

---

## Wire Protocol (WebSocket)

### 帧格式

```
+--------+--------+--------+--------+--------+-- ... --+
| Type   | Length (4 bytes, big-endian)      | Payload |
| (1B)   |                                   |         |
+--------+--------+--------+--------+--------+-- ... --+
```

### 消息类型

| Type | 名称 | Payload 格式 | 方向 |
|------|------|--------------|------|
| 0x00 | Data | 原始字节 (终端 I/O) | 双向 |
| 0x01 | Resize | cols: u16 BE, rows: u16 BE | Client→Server |
| 0x02 | Heartbeat | seq: u32 BE | 双向 |
| 0x03 | Error | UTF-8 错误消息 | Server→Client |

### 心跳机制

- 服务端每 30s 发送心跳 (seq 递增)
- 客户端收到后立即回显相同 seq
- 90s 无响应则断开连接

---

## Tauri Commands

### v2 API (当前版本)

#### `connect_v2`

**请求:**
```typescript
interface ConnectRequest {
  host: string;
  port: number;
  username: string;
  // Auth 使用 serde flatten + tag
  auth_type: 'password' | 'key' | 'default_key';
  password?: string;      // auth_type='password' 时必填
  key_path?: string;      // auth_type='key' 时必填
  passphrase?: string;    // 可选，用于加密密钥
  cols?: number;          // 默认 80
  rows?: number;          // 默认 24
  name?: string;          // 自定义会话名称
}
```

**Rust 端定义:**
```rust
#[derive(Deserialize)]
pub struct ConnectRequest {
    pub host: String,
    pub port: u16,
    pub username: String,
    #[serde(flatten)]
    pub auth: AuthRequest,  // 使用 flatten 展开
    #[serde(default = "default_cols")]
    pub cols: u32,
    #[serde(default = "default_rows")]
    pub rows: u32,
    pub name: Option<String>,
}

#[derive(Deserialize)]
#[serde(tag = "auth_type", rename_all = "snake_case")]
pub enum AuthRequest {
    Password { password: String },
    Key { key_path: String, passphrase: Option<String> },
    DefaultKey { passphrase: Option<String> },
}
```

**响应:**
```typescript
interface ConnectResponseV2 {
  session_id: string;
  ws_url: string;      // e.g., "ws://localhost:55880"
  port: number;
  session: SessionInfo;
}

interface SessionInfo {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  state: 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'error';
  error?: string;
  ws_url?: string;
  color: string;       // 自动生成的 hex 颜色
  uptime_secs: number;
  order: number;       // Tab 排序
}
```

#### `disconnect_v2`

```typescript
// 请求
{ sessionId: string }

// 响应
void (成功) 或 Error string
```

#### `list_sessions_v2`

```typescript
// 请求
(无参数)

// 响应
SessionInfo[]
```

#### `resize_session_v2`

```typescript
// 请求
{ sessionId: string, cols: number, rows: number }

// 响应
void
```

#### `reorder_sessions`

```typescript
// 请求
{ orderedIds: string[] }  // 按顺序排列的 session ID

// 响应
void
```

#### `check_ssh_keys`

```typescript
// 请求
(无参数)

// 响应
interface SshKeyInfo {
  path: string;
  exists: boolean;
  key_type?: string;  // "rsa", "ed25519", "ecdsa"
}[]
```

---

## 数据类型映射

| TypeScript | Rust | 说明 |
|------------|------|------|
| `string` | `String` | UTF-8 编码 |
| `number` | `u16` / `u32` / `i64` | 根据范围选择 |
| `boolean` | `bool` | |
| `string \| null` | `Option<String>` | |
| `{ [key: string]: T }` | `HashMap<String, T>` | |
| Union types | `#[serde(tag = "...")]` enum | 使用 tag 区分 |

### Serde 注意事项

1. **`#[serde(flatten)]`**: 将嵌套结构展开到父级
   ```rust
   struct Parent {
     #[serde(flatten)]
     child: Child,  // Child 的字段会出现在 Parent 同级
   }
   ```

2. **`#[serde(tag = "type")]`**: 用于 TypeScript union types
   ```rust
   #[serde(tag = "auth_type")]
   enum Auth {
     Password { password: String },
     Key { key_path: String },
   }
   ```
   对应 JSON: `{ "auth_type": "password", "password": "xxx" }`

3. **`#[serde(rename_all = "snake_case")]`**: 字段命名风格
   - Rust: `DefaultKey`
   - JSON: `"default_key"`

---

## 版本迁移计划

### 当前状态

- **v1 API** (遗留): `ssh_connect`, `disconnect_session`, `list_sessions`
- **v2 API** (当前): `connect_v2`, `disconnect_v2`, `list_sessions_v2`

### 迁移时间线

| 阶段 | 时间 | 任务 |
|------|------|------|
| 1 | Week 3 ✅ | v2 API 实现并验证 |
| 2 | Week 4 | 移除 v1 前端调用 (`USE_V2_UI` 常量) |
| 3 | Week 5 | 移除 v1 后端 commands |
| 4 | Week 6 | 清理 `USE_V2_UI` flag，简化代码 |

### 技术债清单

- [ ] 移除 `src/store/sessionStore.ts` (v1 store)
- [ ] 移除 `src-tauri/src/commands/connect.rs` (v1 commands)
- [ ] 移除 `src-tauri/src/commands/session.rs` (v1 session commands)
- [ ] 统一 `USE_V2_UI` flag 为单一配置
- [ ] 更新 `components/Sidebar.tsx` 移除 v1 兼容代码
- [ ] 更新 `components/ConnectModal.tsx` 移除 v1 兼容代码

---

## 调试技巧

### 检查 WebSocket 连接

1. 打开 DevTools (Cmd+Option+I)
2. Network 标签 → WS
3. 查看帧内容 (Binary 格式)

### 检查 Tauri Command

1. Console 中查看 `invoke` 错误
2. 后端日志: `cargo run` 输出
3. 常见错误:
   - `invalid type` → Serde 类型不匹配
   - `missing field` → 必填字段未传
   - `unknown variant` → enum tag 错误

### 常见问题

**Q: 前端发送的 JSON 格式错误**
```typescript
// ❌ 错误
{ auth: { type: 'password', password: 'xxx' } }

// ✅ 正确 (使用 flatten)
{ auth_type: 'password', password: 'xxx' }
```

**Q: 终端无法输入**
- 检查 WebSocket 是否连接 (`ws.readyState === WebSocket.OPEN`)
- 检查 `terminal.onData` 是否绑定
- 检查 `terminal.focus()` 是否调用

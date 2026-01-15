# 未来优化方向

本文档汇总了 OxideTerm 的未来性能优化和功能增强方向。

> **注意**：标记为 ✅ 的功能已实现，仅保留未实现部分供参考

---

## 1. 性能优化

### 1.1 前端资源优化 ✅ 已完成

**已实现**：
- ✅ WebGL 渲染已启用（GPU 加速） - `TerminalView.tsx`
- ✅ Vite 构建器内置 tree shaking
- ✅ 代码分割（Code Splitting）- `vite.config.ts` 已配置 manualChunks

**当前打包结果**：
- 主 JS 包 943.97 KB（gzip 后 266.86 KB）
- 已分离 xterm、vendor、radix-ui chunks

**潜在优化（低优先级）**：
- 懒加载非关键组件（SFTP/Forwards 视图）
- 预期收益：初始加载 ↓ 30%，内存占用 ↓ 20%

---

### 1.2 后端滚动缓冲区（WindTerm 风格）⚠️ 部分实现

**当前状态**：
- ✅ 基础滚动缓冲区已实现（`session/scroll_buffer.rs`）
- ✅ 支持 100,000 行缓冲，线程安全
- ✅ 支持范围查询和统计信息
- ⚠️ 但仍在内存中存储，未实现分层压缩
- ❌ 前端仍使用 xterm.js 的滚动缓冲区

**未来优化：分层存储架构**

```
┌─────────────────────────────────────┐
│  Hot Buffer (最近 10,000 行)          │  ← 内存，快速访问
├─────────────────────────────────────┤
│  Warm Buffer (10,000-100,000 行)     │  ← 压缩内存 (zstd)
├─────────────────────────────────────┤
│  Cold Buffer (>100,000 行)           │  ← 磁盘 (redb)
└─────────────────────────────────────┘
```

**核心改进**：
```rust
pub struct TieredScrollBuffer {
    hot: RwLock<VecDeque<TerminalLine>>,     // 最近 10K 行
    warm: RwLock<CompressedLines>,            // zstd 压缩
    cold: ColdStorage,                        // redb 持久化
    total_lines: AtomicU64,
}
```

**预期收益**：
- 前端内存占用 ↓ 60%
- 支持超大日志文件（>100MB）
- 需要前后端架构重构

**实现优先级**：P3（低优先级，现有实现已够用）

---

### 1.3 后端搜索服务 ❌ 未实现

**当前问题**：搜索在前端 JavaScript 中执行（xterm SearchAddon），大日志时会阻塞 UI

**优化方案**：将搜索移到 Rust 后端
```rust
#[tauri::command]
async fn search_terminal_content(
    session_id: String,
    query: String,
    options: SearchOptions,
) -> Result<Vec<SearchMatch>, String> {
    // 多线程搜索，支持正则表达式
    tokio::task::spawn_blocking(move || {
        // 在后端滚动缓冲区中搜索
    }).await
}
```

**预期收益**：搜索不阻塞 UI，CPU 占用 ↓ 70%

**实现优先级**：P2（中等，依赖后端缓冲区完善）

---

## 2. 功能增强

### 2.1 SSH 连接池与重连机制 ✅ 已完成

**已实现功能**：
- ✅ SSH 连接池（`ssh/connection_registry.rs`）
- ✅ 连接复用（多个终端共享同一 SSH 连接）
- ✅ 心跳检测（15s 间隔，2 次失败触发重连）
- ✅ 自动重连（指数退避，最大 5 次重试）
- ✅ Shell 输入锁定（`inputLockedRef` + Input Lock Overlay）
- ✅ 状态事件广播（`connection_status_changed`）
- ✅ 状态守卫（避免重复事件）
- ✅ AppHandle 缓存（启动时未就绪的事件缓存）
- ✅ Port Forward 自动恢复
- ✅ SFTP 传输中断处理（`interruptTransfersBySession`）

详见 [ARCHITECTURE.md - 连接池与重连机制](./ARCHITECTURE.md#连接池与重连机制)

---

### 2.2 SFTP 断点续传 ⚠️ 部分实现

**当前状态**：
- ✅ Pause/Resume 控制已实现（`sftp/transfer.rs`）
- ✅ 使用 `watch::channel` 实现暂停机制
- ❌ Pause 时未保存进度，无法断点续传
- ❌ 网络断开后传输失败，无法恢复

**未来优化**：

#### A. 进度持久化
```rust
pub struct TransferProgress {
    transfer_id: String,
    transferred_bytes: u64,      // 已传输字节数
    total_bytes: u64,            // 总字节数
    status: TransferStatus,      // paused/failed/completed
    last_updated: DateTime<Utc>,
    checkpoint_path: PathBuf,    // 临时文件路径
}
```

#### B. 断点续传逻辑
```rust
pub async fn resume_upload(&self, transfer_id: &str) -> Result<()> {
    let progress = self.load_progress(transfer_id)?;
    let remote_size = self.sftp.stat(&progress.destination_path)?.size;
    
    // 从断点位置继续
    let mut local_file = File::open(&progress.source_path)?;
    local_file.seek(SeekFrom::Start(remote_size))?;
    
    // 追加模式写入
    let mut remote_file = self.sftp.open_mode(
        &progress.destination_path,
        OpenFlags::WRITE | OpenFlags::APPEND,
    )?;
    
    // 继续传输...
}
```

**预期收益**：
- 大文件传输可靠性显著提升
- 支持暂停/恢复
- 网络抖动时自动重试

**实现优先级**：P1（高优先级，用户需求强烈）

---

### 2.3 重连行为优化 ✅ 已完成

**已实现**：
- ✅ 心跳间隔优化（30s → 15s）
- ✅ 失败阈值降低（3 次 → 2 次）
- ✅ Ping 超时优化（10s → 5s）
- ✅ IO 错误直通（立即重连，不等第二次）
- ✅ 状态守卫（避免重复事件）
- ✅ 事件缓存（AppHandle 未就绪时保护）

**未来可选优化**：
1. **智能重连策略**：根据断开原因选择重连参数
   - 网络超时：快速重试（1s, 2s, 4s）
   - 认证失败：停止重连，要求用户干预
   - 服务器断开：中等速度重试（5s, 10s, 20s）

2. **重连进度详情**：
   - 显示当前尝试次数和预计下次重试时间
   - 显示断开原因和诊断信息

**实现优先级**：P2（体验优化，现有实现已满足基本需求）

---

## 3. 架构改进

### 3.1 前端迁移 ✅ 已完成

**已完成**（2026-01-15）：
- ✅ `appStore.ts` 状态重构
- ✅ 新增 `connectSsh`、`disconnectSsh`、`createTerminalSession` 等 API
- ✅ `NewConnectionModal.tsx` 迁移到连接池架构
- ✅ `TabBar.tsx` 关闭逻辑优化
- ✅ 连接管理 UI

详见已删除的开发文档 `PHASE2_FRONTEND_MIGRATION.md`（所有内容已实现）

---

### 3.2 连接池持久化 ❌ 未实现

**当前状态**：应用重启后所有连接丢失

**优化方案**：
- 持久化连接池元数据（host, port, username）
- 应用启动时显示"最近连接"
- 支持"快速重连"（重新认证）

**实现优先级**：P2（用户体验优化）

---

### 3.3 WebSocket 协议优化 ❌ 未实现

**当前协议**：二进制帧（Type + Length + Data）

**潜在优化**：批量传输
```
┌─────────┬──────────┬───────┬─────────────┬───────┬────────┐
│ Batch(1B)│ Count(2B)│Type(1B)│ Length(4B) │ Data  │  ...   │
└─────────┴──────────┴───────┴─────────────┴───────┴────────┘
```

**预期收益**：高频数据场景下效率 ↑ 20-30%

**实现优先级**：P3（现有协议已够用，收益有限）

---

## 4. 用户体验

### 4.1 终端主题商店 ❌ 未实现

- 内置常用主题（Dracula, Nord, Monokai）
- 支持导入 iTerm2/Windows Terminal 主题
- 实时预览

**实现优先级**：P3（Nice to have）

---

### 4.2 快捷键自定义 ❌ 未实现

- 允许用户自定义所有快捷键
- 支持导入/导出快捷键配置
- 避免与系统快捷键冲突

**实现优先级**：P3

---

### 4.3 会话管理增强 ❌ 未实现

- 会话分组（按项目/环境）
- 会话搜索和过滤
- 批量操作（批量连接/断开）

**实现优先级**：P2

---

## 5. 平台支持

### 5.1 Windows 性能优化 ❌ 未实现

参考 `WINDOWS_OPTIMIZATION_ROADMAP.md`：
- 替换 polling 为 IOCP
- 优化 PTY 性能
- Windows Terminal 集成

**实现优先级**：P1（Windows 用户体验改善）

---

### 5.2 移动端支持 ❌ 未实现

- iOS/Android 版本（基于 Tauri Mobile）
- 触控优化的终端交互
- 移动设备认证（Face ID/指纹）

**实现优先级**：P4（长期规划）

---

## 实施优先级总结

| 优化项 | 优先级 | 难度 | 预期收益 | 状态 |
|--------|--------|------|----------|------|
| SFTP 断点续传 | P1 | 中 | 大文件传输可靠性 ↑↑ | ❌ 未实现 |
| Windows 性能优化 | P1 | 高 | Windows 用户体验 ↑↑ | ❌ 未实现 |
| 连接池持久化 | P2 | 低 | 用户体验 ↑ | ❌ 未实现 |
| 后端搜索服务 | P2 | 中 | 搜索性能 ↑ 70% | ❌ 未实现 |
| 智能重连策略 | P2 | 中 | 重连体验 ↑ | ❌ 未实现 |
| 后端滚动缓冲区分层 | P3 | 高 | 内存占用 ↓ 60% | ⚠️ 基础实现 |
| 终端主题商店 | P3 | 低 | 用户体验 ↑ | ❌ 未实现 |
| WebSocket 批量传输 | P3 | 中 | 效率 ↑ 20-30% | ❌ 未实现 |

---

## 已删除的开发文档

以下开发文档中的内容已全部实现或整合到本文档，已删除：

1. ~~`PHASE2_FRONTEND_MIGRATION.md`~~ - 前端迁移已完成 ✅
2. ~~`SHELL_RECONNECT_BEHAVIOR.md`~~ - Shell 重连行为已实现 ✅
3. ~~`RECONNECT_BACKPRESSURE.md`~~ - 重连机制已实现，背压优化使用 RAF 批量写入 ✅
4. ~~`ISSUES.md`~~ - 已修复的问题不再保留
5. ~~`performance（ingitignore）.md`~~ - 性能优化建议已整合
6. ~~`BACKEND_SCROLL_BUFFER.md`~~ - 基础实现已完成
7. ~~`SCROLL_BUFFER_OPTIMIZATION.md`~~ - 分层存储仍为未来规划
8. ~~`SFTP_RESUME_TRANSFER.md`~~ - 断点续传仍为未来规划

---

*本文档持续更新，基于实际使用反馈调整优先级*

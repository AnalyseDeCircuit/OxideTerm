# SSH Agent 认证功能状态

## 实现概览

本文档记录 SSH Agent 认证功能的当前状态和未来计划。

## ✅ 已完成部分

### 1. 完整的类型系统支持

**后端 (Rust)**：
- ✅ `AuthMethod::Agent` 枚举变体（`src-tauri/src/ssh/config.rs`）
- ✅ `SavedAuth::Agent` 持久化支持（`src-tauri/src/config/types.rs`）
- ✅ `EncryptedAuth::Agent` .oxide 文件支持（`src-tauri/src/oxide_file/format.rs`）
- ✅ 导入导出逻辑完整处理 Agent 类型

**前端 (TypeScript)**：
- ✅ `ConnectRequest.auth_type` 包含 `'agent'`
- ✅ `ConnectionInfo.auth_type` 包含 `'agent'`
- ✅ `ProxyHopConfig.auth_type` 包含 `'agent'`
- ✅ `SaveConnectionRequest.auth_type` 包含 `'agent'`

### 2. 完整的 UI 支持

**三个对话框已更新**：
- ✅ `NewConnectionModal.tsx` - 新建连接支持 Agent 选项
- ✅ `EditConnectionModal.tsx` - 编辑连接支持 Agent 选项
- ✅ `AddJumpServerDialog.tsx` - 跳板机支持 Agent 选项

**UI 特性**：
- ✅ Agent 选项卡/单选按钮
- ✅ 友好的提示信息（中文）
- ✅ 一致的用户体验

### 3. 持久化与导入导出

- ✅ Agent 配置可以保存到本地数据库
- ✅ Agent 配置可以导出到 .oxide 文件
- ✅ .oxide 文件中的 Agent 配置可以导入
- ✅ 不需要 keychain 存储（Agent 本身不存储密码）

### 4. 跨平台检测

- ✅ Unix/Linux/macOS: 检测 `SSH_AUTH_SOCK` 环境变量
- ✅ Windows: 支持 `\\.\pipe\openssh-ssh-agent` 命名管道
- ✅ `is_agent_available()` 函数提供平台检测

### 5. 错误处理

- ✅ 清晰的错误信息
- ✅ 平台特定的帮助提示
- ✅ 建议用户使用密钥文件替代方案

## ⚠️ 待完成部分 (TODO)

### 核心认证流程

**位置**: `src-tauri/src/ssh/agent.rs`

**当前状态**: 
```rust
// TODO: 完整实现 Agent 签名流程
// 
// SSH Agent 认证需要实现：
// 1. 连接到系统 SSH Agent
// 2. 从 Agent 获取公钥列表
// 3. 对每个公钥：
//    a) 发送公钥给服务器
//    b) 接收服务器的挑战 (challenge)
//    c) 请求 Agent 签名挑战
//    d) 发送签名给服务器验证
// 4. 完成认证
```

**技术难点**：
1. **russh 库限制**: `authenticate_publickey()` 需要 `PrivateKey` 类型，但从 Agent 获取的是 `PublicKey`
2. **签名流程**: 需要使用 `AgentClient::sign_request()` 进行挑战签名，但 russh 没有暴露足够的低级 API
3. **协议集成**: 需要手动实现 SSH 协议的 agent 认证消息流

**可能的解决方案**：
- **方案 A**: 等待 russh 库更新，提供更好的 agent 支持 ⭐ (当前选择)
- **方案 B**: 使用 russh 的低级 API 手动实现完整的认证消息流
- **方案 C**: 贡献代码到 russh 项目，添加 agent 认证支持

### 用户当前的变通方法

```bash
# 1. 导出 agent 中的密钥到文件
ssh-add -L > ~/.ssh/id_agent.pub

# 2. 使用对应的私钥文件进行连接
# 在 OxideTerm 中选择 "SSH Key" 而不是 "SSH Agent"

# 3. 或者配置 OpenSSH config 使用 ProxyCommand
```

## 📋 验收标准

当完整实现后，应满足：

- [x] 可以在 UI 中选择 SSH Agent 认证
- [x] Agent 配置可以保存和加载
- [x] Agent 配置可以导出到 .oxide 文件
- [x] .oxide 文件中的 Agent 配置可以导入
- [ ] **实际使用 SSH Agent 连接服务器** 🔴 待实现
- [ ] **跳板机支持 Agent 认证** 🔴 待实现
- [ ] **Agent 连接可以正常重连** 🔴 待实现
- [x] Agent 不可用时显示清晰错误信息
- [x] 三大平台（Windows/macOS/Linux）的 Agent 检测

## 🔄 未来计划

### Phase 1: 研究与设计
- [ ] 深入研究 russh 的低级 API
- [ ] 设计 Agent 签名流程的实现方案
- [ ] 评估是否贡献到 russh 上游项目

### Phase 2: 核心实现
- [ ] 实现 `AgentClient::connect()` 真实连接
- [ ] 实现 `AgentClient::list_identities()` 获取密钥列表
- [ ] 实现挑战-响应签名流程
- [ ] 集成到 `SshClient::connect()` 主流程

### Phase 3: 扩展支持
- [ ] 跳板机 Agent 认证
- [ ] 重连逻辑 Agent 支持
- [ ] Agent 转发 (Agent Forwarding) 功能

### Phase 4: 测试与优化
- [ ] 跨平台集成测试
- [ ] 性能优化
- [ ] 错误处理完善

## 📚 参考资料

- [RFC 4251 - SSH Protocol Architecture](https://tools.ietf.org/html/rfc4251)
- [RFC 4252 - SSH Authentication Protocol](https://tools.ietf.org/html/rfc4252)
- [SSH Agent Protocol (PROTOCOL.agent)](https://github.com/openssh/openssh-portable/blob/master/PROTOCOL.agent)
- [russh Documentation](https://docs.rs/russh/)
- [russh-keys Documentation](https://docs.rs/russh-keys/)

## 📝 开发者注意事项

如果你想参与 Agent 认证的完整实现，请查看：

1. **核心文件**: `src-tauri/src/ssh/agent.rs` - 包含详细的 TODO 注释
2. **测试文件**: 运行 `cargo test --lib agent` 查看测试
3. **相关 Issue**: 在项目中搜索 "SSH Agent" 标签

## 更新日志

- **2026-01-14**: 完成类型系统、UI、持久化和导入导出支持，核心认证流程标记为 TODO
- **未来**: 待 russh 库更新或手动实现完整的签名流程

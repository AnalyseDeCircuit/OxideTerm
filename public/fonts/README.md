# OxideTerm 字体双轨制

OxideTerm 使用 **"双轨制"** 字体系统，提供开箱即用的保底方案与完全自由的自定义能力。

## 双轨制架构

### 预设轨道：内置保底，开箱即用

在设置下拉菜单中提供预设字体选项：

| 字体 | 说明 | 图标支持 |
|------|------|----------|
| **JetBrains Mono NF ✓** | 内置 woff2，绝对不乱码 | ✅ Nerd Font |
| **MesloLGM NF ✓** | 内置 woff2，Apple Menlo 风格 | ✅ Nerd Font |
| **Maple Mono NF CN ✓** | 内置 woff2，CJK 优化，圆润风格 | ✅ Nerd Font + 中文 |
| Cascadia Code | Windows 系统字体（如有） | ⚠️ 需安装 NF 版 |
| Consolas | Windows 系统字体 | ❌ |
| Menlo | macOS 系统字体 | ❌ |

> ✓ 表示内置保底，即使系统没装也能正常显示

### 自定义轨道：无限自由，吃准本机

选择 **"自定义..."** 后，可输入任意字体栈：

```
'Sarasa Fixed SC', 'JetBrainsMono Nerd Font', monospace
```

支持：
- 任意系统已安装的字体
- 多字体优先级排列（按逗号分隔）
- 自动追加 `monospace` 兜底

## 🎯 CJK 智能 Fallback 策略

**核心理念**: 拉丁各异，中文统一

所有字体都自动 fallback 到 **Maple Mono NF CN** 的 CJK 部分：

```
用户选择 "JetBrains Mono NF"
    ↓
浏览器渲染时：
  - 拉丁字母 (A-Z, 0-9) → JetBrains Mono (保持原有风格)
  - 中日韩字符 (中文/日文/韩文) → Maple Mono NF CN (统一 CJK)
  - Nerd Font 图标 → JetBrains Mono NF
```

**优势**：
- 🎨 拉丁字母保持各字体独特风格（JetBrains 的锐利、Meslo 的圆润等）
- 🇨🇳 中日韩字符全部使用 Maple Mono 的优秀 CJK 字形
- 📦 即使选择没有 CJK 的字体（如 Consolas），中文也能正常显示

## 字体加载策略

字体栈示例（JetBrains Mono）：

```css
font-family: 
  "JetBrainsMono Nerd Font",     /* 系统 NF */
  "JetBrainsMono Nerd Font Mono",/* 系统 NF Mono */
  "JetBrains Mono NF",           /* 内置 woff2 */
  "JetBrains Mono",              /* 系统原版 */
  "Maple Mono NF CN",            /* CJK fallback */
  monospace;                     /* 最终兜底 */
```

## 内置字体文件

| 文件夹 | 格式 | 大小 | 许可证 |
|--------|------|------|--------|
| `JetBrainsMono/` | WOFF2 | ~4.0 MB | OFL |
| `Meslo/` | WOFF2 | ~4.7 MB | Apache 2.0 |
| `MapleMono/` | WOFF2 | ~25 MB | OFL |

**总计 ~34 MB**（WOFF2 压缩格式）

> **注意**: Maple Mono NF CN 包含完整 CJK（中日韩）字符集，因此体积较大，但对中文用户体验极佳，且作为所有字体的 CJK fallback 非常值得。

---

Last updated: 2025-02-04

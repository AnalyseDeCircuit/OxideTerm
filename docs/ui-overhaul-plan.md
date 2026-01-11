# OxideTerm UI 换血级重构计划

> **目标**: 从"廉价 Demo"升级至 Raycast/Obsidian 级别质感
> **设计原则**: 极简极客风 · macOS 原生感 · 无干扰 · 深度中性色

---

## 🎯 核心设计决策

| 决策项 | 选择 | 理由 |
|-------|------|------|
| **图标系统** | Lucide-react SVG | Emoji 轻浮，SVG 线性感符合极客审美 |
| **欢迎页布局** | 无卡片 + 收紧间距 | 用留白营造视觉重心，避免生硬边界 |
| **品牌图标** | 缩小(w-14) + 蓝紫外发光 | 深邃能量源感，非贴纸感 |
| **按钮边框** | 非悬停 &lt;5% 透明度 | 交互时才显现，减少视觉噪音 |

---

## 📋 执行步骤

### Step 1: 安装 Lucide-react 图标库
```bash
npm install lucide-react
```

### Step 2: 扩展设计令牌 (Design Tokens)

**文件**: `src/styles.css`

新增变量：
```css
/* 超低透明度分隔线 (Raycast 标准) */
--separator-subtle: rgba(255, 255, 255, 0.02);
--separator-light: rgba(255, 255, 255, 0.04);
--separator-medium: rgba(255, 255, 255, 0.06);

/* 悬停/激活态覆盖层 */
--hover-overlay: rgba(255, 255, 255, 0.03);
--active-overlay: rgba(255, 255, 255, 0.06);

/* 精致 Easing 曲线 */
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
```

**文件**: `tailwind.config.js`

扩展 sidebar 语义色：
```javascript
sidebar: {
  bg: 'rgba(24, 24, 37, 0.75)',
  'bg-solid': '#181825',
  border: 'rgba(255, 255, 255, 0.04)',
  'border-subtle': 'rgba(255, 255, 255, 0.02)',
  hover: 'rgba(255, 255, 255, 0.03)',
  'hover-strong': 'rgba(255, 255, 255, 0.06)',
  active: 'rgba(137, 180, 250, 0.12)',
  'active-border': 'rgba(137, 180, 250, 0.20)',
}
```

### Step 3: 重写按钮样式系统

**文件**: `src/styles.css`

```css
/* Ghost Button (默认) */
.btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.02); /* 几乎不可见 */
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  transition: all var(--transition-normal);
}

.btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(137, 180, 250, 0.20); /* 紫色微光边框 */
  box-shadow: 0 2px 8px rgba(137, 180, 250, 0.08);
}

.btn:active {
  transform: scale(0.98);
  background: rgba(255, 255, 255, 0.10);
}

/* Primary Button */
.btn-primary {
  background: linear-gradient(to bottom, rgba(137, 180, 250, 0.15), rgba(137, 180, 250, 0.08));
  border: 1px solid rgba(137, 180, 250, 0.10);
  color: var(--color-blue);
}

.btn-primary:hover {
  background: linear-gradient(to bottom, rgba(137, 180, 250, 0.25), rgba(137, 180, 250, 0.12));
  border-color: rgba(137, 180, 250, 0.30);
  box-shadow: 0 4px 12px rgba(137, 180, 250, 0.15);
}
```

### Step 4: 修复 ConnectionList 配色脱离

**文件**: `src/components/ConnectionList.tsx`

| 旧样式 | 新样式 |
|-------|-------|
| `bg-gray-800` | `bg-surface-0/50` |
| `border-gray-700` | `border-white/[0.04]` |
| `text-gray-500` | `text-overlay-0` |
| `hover:bg-gray-800` | `hover:bg-white/[0.03]` |
| `text-blue-400` | `text-blue` |
| Emoji 图标 | Lucide SVG 图标 |

ViewMode Tabs 改为 Pill 风格：
```tsx
<div className="flex mx-3 p-1 bg-black/20 rounded-xl">
  <button className={active ? 'bg-surface-1/80 text-text' : 'text-overlay-1 hover:bg-white/[0.03]'}>
    <Clock className="w-3.5 h-3.5" /> Recent
  </button>
</div>
```

### Step 5: 重构 Sidebar 视觉层级

**文件**: `src/components/Sidebar.tsx`

| 区域 | 修改内容 |
|------|---------|
| Header | `border-b border-white/[0.02]`，增加 `pb-4` |
| New Connection | 改用 `.btn-primary` 样式 |
| Tab Switcher | `bg-black/20 rounded-xl`，增加 `mb-5` |
| 内容区 | `px-4` 统一内边距 |
| Footer | `border-white/[0.02]`，`py-4` |

### Step 6: 优化 WelcomeScreen

**文件**: `src/App.tsx`

闪电图标处理：
```tsx
<div className="relative mb-8">
  {/* 外发光层 */}
  <div className="absolute -inset-8 bg-gradient-to-r from-blue/20 via-mauve/15 to-blue/20 rounded-full blur-3xl opacity-60" />
  {/* 图标 */}
  <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-blue/20 to-mauve/20 
    border border-white/[0.06] flex items-center justify-center backdrop-blur-sm">
    <Zap className="w-7 h-7 text-blue" />
  </div>
</div>
```

收紧间距：
- Logo `mb-8` (与标题)
- Title `mb-3` (与描述)
- Description `mb-8` (与按钮)
- Feature Pills `mt-10 gap-2 text-xs opacity-70`
- kbd 标签 `bg-black/30 text-[11px] border-white/[0.04]`

---

## 📁 影响文件清单

| 文件 | 修改类型 | 优先级 |
|------|---------|-------|
| `package.json` | 添加 lucide-react 依赖 | P0 |
| `src/styles.css` | 扩展设计令牌 + 重写按钮 | P0 |
| `tailwind.config.js` | 扩展语义色 | P0 |
| `src/components/ConnectionList.tsx` | 配色修复 + SVG 图标 | P0 |
| `src/components/Sidebar.tsx` | 间距 + 分隔线 | P1 |
| `src/App.tsx` | WelcomeScreen 优化 | P1 |

---

## ✅ 验收标准

- [ ] 所有 `gray-*` 硬编码颜色已替换为设计系统变量
- [ ] 分隔线透明度 ≤ 4%
- [ ] 按钮非悬停态边框几乎不可见
- [ ] Emoji 全部替换为 Lucide SVG
- [ ] 8px 栅格间距系统统一
- [ ] 悬停态有微妙的紫色辉光反馈

---

*Created: 2026-01-12*
*Design System: Catppuccin Mocha + Custom Refinements*

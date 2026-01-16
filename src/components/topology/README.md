# Topology Visualization Component

## 功能说明

这个组件用于可视化显示当前的 SSH 连接拓扑关系。

### 特点

- ✅ **只用于展示** - 不涉及任何操作功能
- ✅ **简单高效** - 使用纯 SVG 渲染，无需 D3.js 等重型库
- ✅ **按需显示** - 点击按钮后弹出对话框，不影响主界面
- ✅ **自动过滤** - 只显示已连接或正在连接的节点

## 文件结构

```
src/lib/topologyUtils.ts       # 工具函数（数据转换、布局计算）
src/components/topology/
  ├── TopologyView.tsx        # SVG 拓扑图渲染组件
  ├── TopologyDialog.tsx       # 对话框组件
  └── index.ts                 # 导出文件
```

## 使用方法

### 在 Sidebar 中

```tsx
import { TopologyDialog } from '../topology';

export const Sidebar = () => {
  return (
    <div>
      {/* 其他组件 */}

      {/* 拓扑按钮 */}
      <TopologyDialog />
    </div>
  );
};
```

### 独立使用

```tsx
import { TopologyView } from '../topology';
import { buildTopologyTree } from '../lib/topologyUtils';

const MyComponent = () => {
  const nodes = buildTopologyTree(flatNodes);

  return (
    <TopologyView nodes={nodes} />
  );
};
```

## 数据流程

```
1. 从 sessionTreeStore 获取 rawNodes
   ↓
2. 过滤：只保留已连接/正在连接的节点
   ↓
3. 转换：buildTopologyTree(flatNodes) => TopologyNode[]
   ↓
4. 布局：calculateTreeLayout(nodes) => LayoutNode[][]
   ↓
5. 渲染：SVG 绘制节点和连接线
```

## 扩展建议

### 添加节点点击事件

```tsx
// TopologyView.tsx
<rect
  onClick={() => onNodeClick?.(node)}
  style={{ cursor: 'pointer' }}
/>
```

### 添加 Hover 提示

```tsx
// 使用简单的 title 属性
<rect title={`${node.name}\n${node.host}`} />

// 或使用自定义 Tooltip 组件
```

### 添加动画

```css
.node-rect {
  transition: all 0.3s ease;
}

.node-rect:hover {
  filter: brightness(1.1);
  transform: scale(1.05);
}
```

## 性能说明

- 适用于 < 100 个节点的场景
- 使用 SVG，DOM 元素数量 = 节点数 + 连接数
- 如果节点数过多，建议：
  - 添加分页或缩放功能
  - 使用 Canvas 而非 SVG
  - 限制显示的深度（如只显示前 3 层）

## 已知限制

1. **不支持拖拽** - 按设计只用于展示
2. **不支持缩放** - 简化实现，自动计算画布大小
3. **布局算法简单** - 使用自顶向下的树形布局

## 未来可能的改进

- [ ] 添加缩放/平移功能
- [ ] 支持点击节点查看详情
- [ ] 支持导出拓扑图为图片
- [ ] 添加动画效果（连接状态变化时）
- [ ] 支持水平/垂直布局切换

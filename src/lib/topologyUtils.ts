/**
 * Topology Visualization Utilities
 *
 * 将 SessionTree 的扁平节点转换为树形结构用于可视化
 */

import type { FlatNode } from '../types';

/**
 * 树形节点（用于可视化）
 */
export interface TopologyNode {
  id: string;
  name: string;
  host: string;
  username: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'failed' | 'pending';
  depth: number;
  children: TopologyNode[];
}

/**
 * 将扁平节点列表转换为树形结构
 * @param flatNodes 扁平节点列表
 * @returns 树形结构的根节点列表
 */
export function buildTopologyTree(flatNodes: FlatNode[]): TopologyNode[] {
  const nodeMap = new Map<string, TopologyNode>();
  const roots: TopologyNode[] = [];

  // 第一遍：创建所有节点
  flatNodes.forEach(flatNode => {
    const status = extractStatus(flatNode);

    nodeMap.set(flatNode.id, {
      id: flatNode.id,
      name: flatNode.displayName || `${flatNode.username}@${flatNode.host}`,
      host: flatNode.host,
      username: flatNode.username,
      status,
      depth: flatNode.depth,
      children: [],
    });
  });

  // 第二遍：建立父子关系
  flatNodes.forEach(flatNode => {
    const node = nodeMap.get(flatNode.id)!;

    if (flatNode.parentId) {
      const parent = nodeMap.get(flatNode.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        // 父节点不存在，作为根节点
        roots.push(node);
      }
    } else {
      // 没有父节点，作为根节点
      roots.push(node);
    }
  });

  return roots;
}

/**
 * 从 FlatNode 提取状态
 */
function extractStatus(flatNode: FlatNode): TopologyNode['status'] {
  const state = flatNode.state.status;

  if (state === 'connected') return 'connected';
  if (state === 'connecting') return 'connecting';
  if (state === 'failed') return 'failed';
  if (state === 'pending') return 'pending';
  return 'disconnected';
}

/**
 * 获取节点颜色
 */
export function getNodeColor(status: TopologyNode['status']): string {
  switch (status) {
    case 'connected':
      return '#4CAF50';  // 绿色
    case 'connecting':
      return '#FFC107';  // 黄色
    case 'failed':
      return '#F44336';  // 红色
    case 'pending':
      return '#9E9E9E';  // 灰色
    case 'disconnected':
      return '#9E9E9E';  // 灰色
    default:
      return '#9E9E9E';
  }
}

/**
 * 计算树形布局
 * @param nodes 根节点列表
 * @param options 布局选项
 * @returns 包含位置信息的节点列表
 */
export interface LayoutNode extends Omit<TopologyNode, 'children'> {
  x: number;
  y: number;
  width: number;
  height: number;
  children: LayoutNode[];
}

export interface LayoutOptions {
  nodeWidth?: number;
  nodeHeight?: number;
  verticalGap?: number;
  horizontalGap?: number;
}

export function calculateTreeLayout(
  nodes: TopologyNode[],
  options: LayoutOptions = {}
): LayoutNode[][] {
  const {
    nodeWidth = 120,
    nodeHeight = 40,
    verticalGap = 80,
    horizontalGap = 140,
  } = options;

  const layers: LayoutNode[][] = [];

  // 递归计算每个节点的位置
  function layoutNode(
    node: TopologyNode,
    depth: number,
    xOffset: number
  ): LayoutNode {
    const result: LayoutNode = {
      ...node,
      x: xOffset,
      y: 50 + depth * verticalGap,
      width: nodeWidth,
      height: nodeHeight,
      children: [], // 初始化为空，稍后填充
    };

    // 确保当前层存在
    if (!layers[depth]) {
      layers[depth] = [];
    }
    layers[depth].push(result);

    // 递归布局子节点
    if (node.children.length > 0) {
      const totalWidth = (node.children.length - 1) * horizontalGap;
      const startX = xOffset - totalWidth / 2;

      result.children = node.children.map((child, index) => {
        const childX = startX + index * horizontalGap;
        return layoutNode(child, depth + 1, childX);
      });
    }

    return result;
  }

  // 布局所有根节点
  const totalRootWidth = (nodes.length - 1) * (horizontalGap * 2);
  const startRootX = 400 - totalRootWidth / 2; // 居中

  nodes.forEach((root, index) => {
    const rootX = startRootX + index * (horizontalGap * 2);
    layoutNode(root, 0, rootX);
  });

  return layers;
}

/**
 * Topology Dialog Component
 *
 * 显示当前连接拓扑的对话框
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { useSessionTreeStore } from '../../store/sessionTreeStore';
import { TopologyView } from './TopologyView';
import { buildTopologyTree } from '../../lib/topologyUtils';
import type { TopologyNode } from '../../lib/topologyUtils';
import { Network, X } from 'lucide-react';

/**
 * 拓扑图对话框
 */
export const TopologyDialog: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<TopologyNode[]>([]);

  const { rawNodes } = useSessionTreeStore();

  // 打开对话框时构建树
  const handleOpen = () => {
    // 只显示已连接的节点
    const connectedNodes = rawNodes.filter(
      node => node.state.status === 'connected' || node.state.status === 'connecting'
    );

    const topologyTree = buildTopologyTree(connectedNodes);
    setTree(topologyTree);
    setOpen(true);
  };

  return (
    <>
      {/* 触发按钮 */}
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors text-sm"
        title="View Topology"
      >
        <Network className="h-4 w-4" />
      </button>

      {/* 对话框 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl w-full p-0 bg-transparent border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
          <DialogHeader className="p-4 bg-[#0c0d0f] border-b border-zinc-800">
            <DialogTitle className="flex items-center justify-between text-zinc-100">
              <div className="flex items-center gap-2">
                <Network className="h-5 w-5 text-green-500" />
                <span>Connection Matrix</span>
              </div>
              <div className="flex items-center gap-4">
                {tree.length > 0 && (
                  <span className="text-xs font-mono text-zinc-500 tracking-wider">
                    SYSTEM_STATUS: ONLINE ({getTreeStats(tree)})
                  </span>
                )}
                <button 
                  onClick={() => setOpen(false)}
                  className="rounded-full p-1 hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* 拓扑图容器 - Main Canvas */}
          <div className="relative bg-[#0c0d0f] min-h-[500px] flex flex-col">
            
            {/* Legend Overlay */}
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 p-3 rounded-lg bg-black/40 backdrop-blur-sm border border-white/5">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1 font-bold">Signal Status</div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] shadow-[0_0_8px_#22c55e]" />
                  <span className="text-xs text-zinc-300">Active</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#eab308] shadow-[0_0_8px_#eab308]" />
                  <span className="text-xs text-zinc-300">Connecting</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#71717a]" />
                  <span className="text-xs text-zinc-500">Idle</span>
                </div>
            </div>

            {/* View Component */}
            <TopologyView nodes={tree} />
          
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

/**
 * 获取树统计信息
 */
function getTreeStats(nodes: TopologyNode[]): string {
  let totalNodes = 0;
  let maxDepth = 0;

  function traverse(nodeList: TopologyNode[], depth: number) {
    nodeList.forEach(node => {
      totalNodes++;
      maxDepth = Math.max(maxDepth, depth);

      if (node.children.length > 0) {
        traverse(node.children, depth + 1);
      }
    });
  }

  traverse(nodes, 1);

  if (totalNodes === 1) {
    return '1 active connection';
  }

  return `${totalNodes} active connections, max depth: ${maxDepth}`;
}

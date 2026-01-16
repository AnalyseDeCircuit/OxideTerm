/**
 * Save Path As Preset Dialog
 * 
 * 将动态钻入路径（模式3）保存为预设连接（模式1）
 * 遍历从根节点到目标节点的完整路径，构建 proxy_chain
 */

import React, { useState, useMemo } from 'react';
import { X, Save, Server, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';
import type { FlatNode, SaveConnectionRequest, ProxyHopInfo } from '@/types';

interface SavePathAsPresetDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetNodeId: string;
  nodes: FlatNode[];
  onSaved?: () => void;
}

export const SavePathAsPresetDialog: React.FC<SavePathAsPresetDialogProps> = ({
  isOpen,
  onClose,
  targetNodeId,
  nodes,
  onSaved,
}) => {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 构建从根到目标节点的路径
  const pathNodes = useMemo(() => {
    const path: FlatNode[] = [];
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    let current = nodeMap.get(targetNodeId);
    while (current) {
      path.unshift(current);
      current = current.parentId ? nodeMap.get(current.parentId) : undefined;
    }
    
    return path;
  }, [targetNodeId, nodes]);

  // 目标节点
  const targetNode = pathNodes[pathNodes.length - 1];

  // 默认名称
  const defaultName = useMemo(() => {
    if (!targetNode) return '';
    return targetNode.displayName || `${targetNode.username}@${targetNode.host}`;
  }, [targetNode]);

  // 当对话框打开时重置状态
  React.useEffect(() => {
    if (isOpen) {
      setName(defaultName);
      setError(null);
      setSaving(false);
    }
  }, [isOpen, defaultName]);

  if (!isOpen || !targetNode) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      setError('请输入连接名称');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // 构建 proxy_chain（暂存，等后端支持后使用）
      // 跳过最后一个节点（目标节点），前面的节点作为 proxy_chain
      const proxyChain: ProxyHopInfo[] = pathNodes.slice(0, -1).map(node => ({
        host: node.host,
        port: node.port,
        username: node.username,
        // 注意：这里我们无法获取原始认证信息，使用 agent 作为默认
        auth_type: 'agent' as const,
      }));

      // 构建连接配置
      const request: SaveConnectionRequest = {
        name: name.trim(),
        group: null,
        host: targetNode.host,
        port: targetNode.port,
        username: targetNode.username,
        auth_type: 'agent', // 默认使用 agent
        tags: ['从钻入路径保存'],
      };

      // TODO: 后端需要扩展 save_connection 以支持 proxy_chain
      // 当前保存时会丢失跳板机链路信息
      console.log('Proxy chain for future use:', proxyChain);

      // 保存连接
      await api.saveConnection(request);

      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[#1e1e1e] border border-white/10 rounded-lg shadow-xl w-[480px] max-h-[80vh] overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Save className="w-5 h-5 text-blue-400" />
            <span className="font-medium">保存为预设连接</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-4 space-y-4">
          {/* 路径预览 */}
          <div className="bg-black/20 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-2">连接路径</div>
            <div className="flex flex-wrap items-center gap-1">
              {pathNodes.map((node, index) => (
                <React.Fragment key={node.id}>
                  <div 
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                      index === pathNodes.length - 1 
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                        : 'bg-white/5 text-gray-300'
                    }`}
                  >
                    <Server className="w-3 h-3" />
                    <span>{node.displayName || `${node.username}@${node.host}`}</span>
                  </div>
                  {index < pathNodes.length - 1 && (
                    <ArrowRight className="w-3 h-3 text-gray-500" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* 名称输入 */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">连接名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入连接名称"
              className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-md text-sm focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          {/* 说明 */}
          <div className="text-xs text-gray-500 bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3">
            <p className="mb-1">⚠️ 注意事项：</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>将使用 SSH Agent 进行认证</li>
              <li>如需其他认证方式，请在保存后编辑连接</li>
              <li>保存后可在连接列表中找到此连接</li>
            </ul>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-white/10 bg-black/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                保存
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SavePathAsPresetDialog;

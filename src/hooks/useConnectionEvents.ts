/**
 * Hook to listen for SSH connection status change events from backend
 * 
 * 统一事件系统 (Phase 2 重构)
 * 
 * Events:
 * - connection_status_changed: { connection_id, status, affected_children, timestamp }
 * - connection_reconnect_progress: { connection_id, attempt, max_attempts, next_retry_ms, timestamp }
 * - connection_reconnected: { connection_id, terminal_ids, forward_ids }
 */

import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useAppStore } from '../store/appStore';
import { useTransferStore } from '../store/transferStore';
import { useSessionTreeStore, type ReconnectProgress } from '../store/sessionTreeStore';
import { topologyResolver } from '../lib/topologyResolver';
import { api } from '../lib/api';
import type { SshConnectionState } from '../types';

interface ConnectionStatusEvent {
  connection_id: string;
  status: 'connected' | 'link_down' | 'reconnecting' | 'disconnected';
  affected_children: string[];  // 新增：受影响的子连接
  timestamp: number;            // 新增：时间戳
}

interface ConnectionReconnectProgressEvent {
  connection_id: string;
  attempt: number;
  max_attempts: number | null;
  next_retry_ms: number;
  timestamp: number;
}

interface ConnectionReconnectedEvent {
  connection_id: string;
  terminal_ids: string[];
  forward_ids: string[];
}

export function useConnectionEvents(): void {
  const { updateConnectionState, sessions } = useAppStore();
  const { interruptTransfersBySession } = useTransferStore();

  useEffect(() => {
    // 获取 sessionTreeStore 方法（避免闭包问题）
    const getTreeStore = () => useSessionTreeStore.getState();

    // Listen for connection status changes from backend
    const unlistenStatus = listen<ConnectionStatusEvent>('connection_status_changed', (event) => {
      const { connection_id, status, affected_children } = event.payload;
      console.log(`[ConnectionEvents] ${connection_id} -> ${status}`, { affected_children });

      // Map backend status to frontend state
      let state: SshConnectionState;
      switch (status) {
        case 'connected':
          state = 'active';
          break;
        case 'link_down':
          state = 'link_down';
          break;
        case 'reconnecting':
          state = 'reconnecting';
          break;
        case 'disconnected':
          state = 'disconnected';
          break;
        default:
          console.warn(`[ConnectionEvents] Unknown status: ${status}`);
          return;
      }

      updateConnectionState(connection_id, state);

      // 使用拓扑解析器处理 link-down 级联
      if (status === 'link_down') {
        const affectedNodeIds = topologyResolver.handleLinkDown(connection_id, affected_children);
        if (affectedNodeIds.length > 0) {
          console.log(`[ConnectionEvents] Marking nodes as link-down:`, affectedNodeIds);
          getTreeStore().markLinkDownBatch(affectedNodeIds);
        }
      }

      // 重连成功时清除 link-down 标记
      if (status === 'connected') {
        const nodeId = topologyResolver.getNodeId(connection_id);
        if (nodeId) {
          console.log(`[ConnectionEvents] Clearing link-down for node ${nodeId}`);
          getTreeStore().clearLinkDown(nodeId);
          // 清除重连进度
          getTreeStore().setReconnectProgress(nodeId, null);
        }
      }

      // When connection goes down, interrupt all SFTP transfers for related sessions
      if (status === 'link_down' || status === 'disconnected') {
        // Find all sessions using this connection and interrupt their transfers
        sessions.forEach((session, sessionId) => {
          if (session.connectionId === connection_id) {
            interruptTransfersBySession(sessionId, 
              status === 'link_down' ? 'Connection lost - reconnecting...' : 'Connection closed'
            );
          }
        });
      }
    });

    // Listen for reconnect progress events
    const unlistenProgress = listen<ConnectionReconnectProgressEvent>('connection_reconnect_progress', (event) => {
      const { connection_id, attempt, max_attempts, next_retry_ms } = event.payload;
      console.log(`[ConnectionEvents] Reconnect progress: ${connection_id} attempt ${attempt}/${max_attempts ?? '∞'}`);

      // 通过拓扑解析器找到对应节点
      const nodeId = topologyResolver.getNodeId(connection_id);
      if (nodeId) {
        const progress: ReconnectProgress = {
          attempt,
          maxAttempts: max_attempts,
          nextRetryMs: next_retry_ms,
        };
        getTreeStore().setReconnectProgress(nodeId, progress);
      }
    });

    // Listen for connection reconnected events from backend
    const unlistenReconnected = listen<ConnectionReconnectedEvent>('connection_reconnected', (event) => {
      const { connection_id, terminal_ids, forward_ids } = event.payload;
      console.log(`[ConnectionEvents] Connection ${connection_id} reconnected`, {
        terminal_ids,
        forward_ids,
      });

      // Update connection state to active
      updateConnectionState(connection_id, 'active');

      // 通过拓扑解析器找到对应节点并清除 link-down
      const nodeId = topologyResolver.getNodeId(connection_id);
      if (nodeId) {
        console.log(`[ConnectionEvents] Clearing link-down for node ${nodeId}`);
        getTreeStore().clearLinkDown(nodeId);
        getTreeStore().setReconnectProgress(nodeId, null);
      }

      // 恢复终端 WebSocket 连接
      if (terminal_ids.length > 0) {
        console.log(`[ConnectionEvents] Restoring terminals:`, terminal_ids);
        restoreTerminalConnections(terminal_ids);
      }

      // TODO: Restore port forwards if needed
      if (forward_ids.length > 0) {
        console.log(`[ConnectionEvents] TODO: Restore forwards:`, forward_ids);
      }
    });

    return () => {
      unlistenStatus.then((fn) => fn());
      unlistenProgress.then((fn) => fn());
      unlistenReconnected.then((fn) => fn());
    };
  }, [updateConnectionState, sessions, interruptTransfersBySession]);
}

/**
 * 恢复终端 WebSocket 连接
 * 
 * 原理：
 * 1. 调用后端 recreate_terminal_pty 为每个终端重建 PTY 和 WebSocket bridge
 * 2. 更新 appStore.sessions 中的 ws_url
 * 3. TerminalView 监听 session.ws_url 变化，自动重连
 */
async function restoreTerminalConnections(terminalIds: string[]): Promise<void> {
  const appStore = useAppStore.getState();

  for (const terminalId of terminalIds) {
    const session = appStore.sessions.get(terminalId);
    if (!session) {
      console.warn(`[ConnectionEvents] Session ${terminalId} not found, skipping restore`);
      continue;
    }

    try {
      console.log(`[ConnectionEvents] Recreating PTY for terminal ${terminalId}`);
      
      // 调用后端重建 PTY 并获取新的 WebSocket 信息
      const result = await api.recreateTerminalPty(terminalId);

      // 直接更新 sessions Map 中的 ws_url 和 ws_token
      // 这会触发 TerminalView 的 useEffect 重连
      useAppStore.setState((state) => {
        const newSessions = new Map(state.sessions);
        const existingSession = newSessions.get(terminalId);
        if (existingSession) {
          newSessions.set(terminalId, {
            ...existingSession,
            ws_url: result.wsUrl,
            ws_token: result.wsToken,
          });
        }
        return { sessions: newSessions };
      });

      console.log(`[ConnectionEvents] Terminal ${terminalId} PTY recreated, new ws_url: ${result.wsUrl}`);
    } catch (e) {
      console.error(`[ConnectionEvents] Failed to restore terminal ${terminalId}:`, e);
    }
  }
}

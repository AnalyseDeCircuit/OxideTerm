/**
 * Hook to listen for SSH connection status change events from backend
 * 
 * Events:
 * - connection_status_changed: { connection_id, status }
 *   status: 'connected' | 'link_down' | 'reconnecting' | 'disconnected'
 * - connection_reconnected: { connection_id, terminal_ids, forward_ids }
 */

import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useAppStore } from '../store/appStore';
import { useTransferStore } from '../store/transferStore';
import { useSessionTreeStore } from '../store/sessionTreeStore';
import type { SshConnectionState } from '../types';

interface ConnectionStatusEvent {
  connection_id: string;
  status: 'connected' | 'link_down' | 'reconnecting' | 'disconnected';
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
    // Listen for connection status changes from backend
    const unlistenStatus = listen<ConnectionStatusEvent>('connection_status_changed', (event) => {
      const { connection_id, status } = event.payload;
      console.log(`[ConnectionEvents] ${connection_id} -> ${status}`);

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

      // Sync to sessionTreeStore: find node by connectionId and update link-down state
      if (status === 'link_down') {
        const { nodes, markLinkDown } = useSessionTreeStore.getState();
        const affectedNode = nodes.find(n => n.runtime?.connectionId === connection_id);
        if (affectedNode) {
          console.log(`[ConnectionEvents] Marking node ${affectedNode.id} as link-down`);
          markLinkDown(affectedNode.id);
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

    // Listen for connection reconnected events from backend
    const unlistenReconnected = listen<ConnectionReconnectedEvent>('connection_reconnected', (event) => {
      const { connection_id, terminal_ids, forward_ids } = event.payload;
      console.log(`[ConnectionEvents] Connection ${connection_id} reconnected`, {
        terminal_ids,
        forward_ids,
      });

      // Update connection state to active
      updateConnectionState(connection_id, 'active');

      // Clear link-down mark in sessionTreeStore
      const { nodes, clearLinkDown } = useSessionTreeStore.getState();
      const affectedNode = nodes.find(n => n.runtime?.connectionId === connection_id);
      if (affectedNode) {
        console.log(`[ConnectionEvents] Clearing link-down for node ${affectedNode.id}`);
        clearLinkDown(affectedNode.id);
      }

      // TODO: Restore terminal WebSocket connections if needed
      // TODO: Restore port forwards if needed
    });

    return () => {
      unlistenStatus.then((fn) => fn());
      unlistenReconnected.then((fn) => fn());
    };
  }, [updateConnectionState, sessions, interruptTransfersBySession]);
}

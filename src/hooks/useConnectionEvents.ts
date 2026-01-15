/**
 * Hook to listen for SSH connection status change events from backend
 * 
 * Events:
 * - connection_status_changed: { connection_id, status }
 *   status: 'connected' | 'link_down' | 'reconnecting' | 'disconnected'
 */

import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useAppStore } from '../store/appStore';
import type { SshConnectionState } from '../types';

interface ConnectionStatusEvent {
  connection_id: string;
  status: 'connected' | 'link_down' | 'reconnecting' | 'disconnected';
}

export function useConnectionEvents(): void {
  const { updateConnectionState } = useAppStore();

  useEffect(() => {
    // Listen for connection status changes from backend
    const unlisten = listen<ConnectionStatusEvent>('connection_status_changed', (event) => {
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
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [updateConnectionState]);
}

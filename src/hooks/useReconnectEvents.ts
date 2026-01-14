import { useEffect } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useAppStore } from '@/store/appStore';
import {
  SessionDisconnectedPayload,
  SessionReconnectingPayload,
  SessionReconnectedPayload,
  SessionReconnectFailedPayload,
  SessionReconnectCancelledPayload,
} from '@/types';

// Event names must match backend constants
const EVENT_NAMES = {
  DISCONNECTED: 'session:disconnected',
  RECONNECTING: 'session:reconnecting',
  RECONNECTED: 'session:reconnected',
  RECONNECT_FAILED: 'session:reconnect_failed',
  RECONNECT_CANCELLED: 'session:reconnect_cancelled',
} as const;

/**
 * Hook to subscribe to Tauri reconnection events.
 * Should be mounted once at the app root level.
 */
export function useReconnectEvents(): void {
  const {
    _handleSessionDisconnected,
    _handleSessionReconnecting,
    _handleSessionReconnected,
    _handleSessionReconnectFailed,
    _handleSessionReconnectCancelled,
  } = useAppStore();

  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];

    const setupListeners = async () => {
      try {
        // Subscribe to session:disconnected events
        const unlistenDisconnected = await listen<SessionDisconnectedPayload>(
          EVENT_NAMES.DISCONNECTED,
          (event) => {
            console.log('[Reconnect] Received disconnected event:', event.payload);
            _handleSessionDisconnected(event.payload);
          }
        );
        unlisteners.push(unlistenDisconnected);

        // Subscribe to session:reconnecting events
        const unlistenReconnecting = await listen<SessionReconnectingPayload>(
          EVENT_NAMES.RECONNECTING,
          (event) => {
            console.log('[Reconnect] Received reconnecting event:', event.payload);
            _handleSessionReconnecting(event.payload);
          }
        );
        unlisteners.push(unlistenReconnecting);

        // Subscribe to session:reconnected events
        const unlistenReconnected = await listen<SessionReconnectedPayload>(
          EVENT_NAMES.RECONNECTED,
          (event) => {
            console.log('[Reconnect] Received reconnected event:', event.payload);
            _handleSessionReconnected(event.payload);
          }
        );
        unlisteners.push(unlistenReconnected);

        // Subscribe to session:reconnect_failed events
        const unlistenFailed = await listen<SessionReconnectFailedPayload>(
          EVENT_NAMES.RECONNECT_FAILED,
          (event) => {
            console.log('[Reconnect] Received reconnect_failed event:', event.payload);
            _handleSessionReconnectFailed(event.payload);
          }
        );
        unlisteners.push(unlistenFailed);

        // Subscribe to session:reconnect_cancelled events
        const unlistenCancelled = await listen<SessionReconnectCancelledPayload>(
          EVENT_NAMES.RECONNECT_CANCELLED,
          (event) => {
            console.log('[Reconnect] Received reconnect_cancelled event:', event.payload);
            _handleSessionReconnectCancelled(event.payload);
          }
        );
        unlisteners.push(unlistenCancelled);

        console.log('[Reconnect] Event listeners registered successfully');
      } catch (error) {
        console.error('[Reconnect] Failed to setup event listeners:', error);
      }
    };

    setupListeners();

    return () => {
      // Cleanup all listeners on unmount
      unlisteners.forEach((unlisten) => unlisten());
      console.log('[Reconnect] Event listeners cleaned up');
    };
  }, [
    _handleSessionDisconnected,
    _handleSessionReconnecting,
    _handleSessionReconnected,
    _handleSessionReconnectFailed,
    _handleSessionReconnectCancelled,
  ]);
}

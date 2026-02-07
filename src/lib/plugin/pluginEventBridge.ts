/**
 * Plugin Event Bridge
 *
 * A simple pub/sub event bus for plugin system events.
 * Bridges appStore state changes to plugin lifecycle events.
 * All handlers are called via queueMicrotask() to avoid blocking state updates.
 */

type EventHandler = (data: unknown) => void;

class PluginEventBridge {
  private handlers = new Map<string, Set<EventHandler>>();

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   */
  on(event: string, handler: EventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    return () => {
      const set = this.handlers.get(event);
      if (set) {
        set.delete(handler);
        if (set.size === 0) this.handlers.delete(event);
      }
    };
  }

  /**
   * Emit an event to all subscribers.
   * Handlers are called asynchronously via queueMicrotask().
   */
  emit(event: string, data: unknown): void {
    const set = this.handlers.get(event);
    if (!set || set.size === 0) return;

    for (const handler of set) {
      queueMicrotask(() => {
        try {
          handler(data);
        } catch (err) {
          console.error(`[PluginEventBridge] Error in handler for "${event}":`, err);
        }
      });
    }
  }

  /**
   * Remove all handlers (used during cleanup).
   */
  clear(): void {
    this.handlers.clear();
  }
}

/** Singleton event bridge instance */
export const pluginEventBridge = new PluginEventBridge();

/**
 * Wire appStore connection state changes → plugin events.
 * Call once at app startup. Returns an unsubscribe function.
 *
 * Accepts the useAppStore reference to avoid `require()` (not available in ESM/Vite).
 */
export function setupConnectionBridge(
  useAppStore: typeof import('../../store/appStore').useAppStore,
): () => void {
  let prevConnections = new Map(useAppStore.getState().connections);

  const unsubscribe = useAppStore.subscribe((state) => {
    const curr = state.connections;

    // Detect new connections (active)
    for (const [id, conn] of curr) {
      const prev = prevConnections.get(id);
      if (!prev && conn.state === 'active') {
        pluginEventBridge.emit('connection:connect', { connectionId: id });
      } else if (prev && prev.state !== conn.state) {
        if (conn.state === 'active' && prev.state !== 'active') {
          pluginEventBridge.emit('connection:connect', { connectionId: id });
        } else if (conn.state !== 'active' && prev.state === 'active') {
          pluginEventBridge.emit('connection:disconnect', { connectionId: id, reason: conn.state });
        }
      }
    }

    // Detect removed connections
    for (const [id] of prevConnections) {
      if (!curr.has(id)) {
        pluginEventBridge.emit('connection:disconnect', { connectionId: id, reason: 'removed' });
      }
    }

    prevConnections = new Map(curr);
  });

  return unsubscribe;
}

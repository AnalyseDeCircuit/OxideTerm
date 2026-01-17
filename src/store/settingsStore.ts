/**
 * Unified Settings Store (v2)
 * 
 * Single Source of Truth for all user preferences and UI state.
 * 
 * Design Principles:
 * 1. All settings read/write through this store
 * 2. Immediate persistence on every change (no beforeunload dependency)
 * 3. Legacy format detection and cleanup (no migration, reset to defaults)
 * 4. Zustand with subscribeWithSelector for reactive updates
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { themes } from '../lib/themes';
import { useToastStore } from '../hooks/useToast';

// ============================================================================
// Constants
// ============================================================================

/** Settings data version, used to detect legacy formats */
const SETTINGS_VERSION = 2;

/** localStorage key */
const STORAGE_KEY = 'oxide-settings-v2';

/** Legacy localStorage keys to clean up */
const LEGACY_KEYS = [
  'oxide-settings',
  'oxide-ui-state',
  'oxide-tree-expanded',
  'oxide-focused-node',
] as const;

// ============================================================================
// Types
// ============================================================================

/** Renderer type */
export type RendererType = 'auto' | 'webgl' | 'canvas';

/** Font family options */
export type FontFamily = 'jetbrains' | 'meslo' | 'tinos' | 'menlo' | 'courier' | 'monospace';

/** Cursor style options */
export type CursorStyle = 'block' | 'underline' | 'bar';

/** Sidebar section options */
export type SidebarSection = 'sessions' | 'saved' | 'sftp' | 'forwards' | 'connections';

/** Terminal settings */
export interface TerminalSettings {
  theme: string;
  fontFamily: FontFamily;
  fontSize: number;        // 8-32
  lineHeight: number;      // 0.8-3.0
  cursorStyle: CursorStyle;
  cursorBlink: boolean;
  scrollback: number;      // xterm scrollback lines
  renderer: RendererType;
}

/** Buffer settings (used by backend) */
export interface BufferSettings {
  maxLines: number;          // Backend ScrollBuffer max lines
  saveOnDisconnect: boolean; // Save buffer on disconnect
}

/** Appearance settings */
export interface AppearanceSettings {
  sidebarCollapsedDefault: boolean;
}

/** Connection defaults */
export interface ConnectionDefaults {
  username: string;
  port: number;
}

/** Tree UI state (persisted for UX, but pruned on rawNodes sync) */
export interface TreeUIState {
  expandedIds: string[];
  focusedNodeId: string | null;
}

/** Sidebar UI state */
export interface SidebarUIState {
  collapsed: boolean;
  activeSection: SidebarSection;
}

/** Complete settings structure */
export interface PersistedSettingsV2 {
  version: 2;
  terminal: TerminalSettings;
  buffer: BufferSettings;
  appearance: AppearanceSettings;
  connectionDefaults: ConnectionDefaults;
  treeUI: TreeUIState;
  sidebarUI: SidebarUIState;
}

// ============================================================================
// Platform Detection
// ============================================================================

const isWindows = typeof navigator !== 'undefined' 
  && navigator.platform.toLowerCase().includes('win');

// ============================================================================
// Default Values
// ============================================================================

const defaultTerminalSettings: TerminalSettings = {
  theme: 'default',
  fontFamily: 'jetbrains',
  fontSize: 14,
  lineHeight: 1.2,
  cursorStyle: 'block',
  cursorBlink: true,
  scrollback: 5000,
  renderer: isWindows ? 'canvas' : 'auto',
};

const defaultBufferSettings: BufferSettings = {
  maxLines: 100000,
  saveOnDisconnect: true,
};

const defaultAppearanceSettings: AppearanceSettings = {
  sidebarCollapsedDefault: false,
};

const defaultConnectionDefaults: ConnectionDefaults = {
  username: 'root',
  port: 22,
};

const defaultTreeUIState: TreeUIState = {
  expandedIds: [],
  focusedNodeId: null,
};

const defaultSidebarUIState: SidebarUIState = {
  collapsed: false,
  activeSection: 'sessions',
};

function createDefaultSettings(): PersistedSettingsV2 {
  return {
    version: 2,
    terminal: { ...defaultTerminalSettings },
    buffer: { ...defaultBufferSettings },
    appearance: { ...defaultAppearanceSettings },
    connectionDefaults: { ...defaultConnectionDefaults },
    treeUI: { ...defaultTreeUIState },
    sidebarUI: { ...defaultSidebarUIState },
  };
}

// ============================================================================
// Persistence Helpers
// ============================================================================

/** Merge saved settings with defaults (handles version upgrades with new fields) */
function mergeWithDefaults(saved: Partial<PersistedSettingsV2>): PersistedSettingsV2 {
  const defaults = createDefaultSettings();
  return {
    version: 2,
    terminal: { ...defaults.terminal, ...saved.terminal },
    buffer: { ...defaults.buffer, ...saved.buffer },
    appearance: { ...defaults.appearance, ...saved.appearance },
    connectionDefaults: { ...defaults.connectionDefaults, ...saved.connectionDefaults },
    treeUI: { ...defaults.treeUI, ...saved.treeUI },
    sidebarUI: { ...defaults.sidebarUI, ...saved.sidebarUI },
  };
}

/** Load settings from localStorage, detect and clean legacy formats */
function loadSettings(): PersistedSettingsV2 {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.version === SETTINGS_VERSION) {
        // Valid v2 format, merge with defaults for any new fields
        return mergeWithDefaults(parsed);
      }
    }
    
    // Check for legacy formats and clean them up
    const hasLegacy = LEGACY_KEYS.some(key => localStorage.getItem(key) !== null);
    if (hasLegacy) {
      console.warn('[SettingsStore] Detected legacy settings format. Clearing and using defaults.');
      LEGACY_KEYS.forEach(key => localStorage.removeItem(key));
    }
  } catch (e) {
    console.error('[SettingsStore] Failed to load settings:', e);
  }
  
  return createDefaultSettings();
}

/** Persist settings to localStorage */
function persistSettings(settings: PersistedSettingsV2): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('[SettingsStore] Failed to persist settings:', e);
  }
}

// ============================================================================
// Store Interface
// ============================================================================

interface SettingsStore {
  // State
  settings: PersistedSettingsV2;
  
  // Actions - Category updates
  updateTerminal: <K extends keyof TerminalSettings>(key: K, value: TerminalSettings[K]) => void;
  updateBuffer: <K extends keyof BufferSettings>(key: K, value: BufferSettings[K]) => void;
  updateAppearance: <K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) => void;
  updateConnectionDefaults: <K extends keyof ConnectionDefaults>(key: K, value: ConnectionDefaults[K]) => void;
  
  // Actions - Tree UI state
  setTreeExpanded: (ids: string[]) => void;
  toggleTreeNode: (nodeId: string) => void;
  setFocusedNode: (nodeId: string | null) => void;
  
  // Actions - Sidebar UI state
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarSection: (section: SidebarSection) => void;
  toggleSidebar: () => void;
  
  // Actions - Bulk operations
  resetToDefaults: () => void;
  
  // Selectors (convenience getters)
  getTerminal: () => TerminalSettings;
  getBuffer: () => BufferSettings;
  getTreeUI: () => TreeUIState;
  getSidebarUI: () => SidebarUIState;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useSettingsStore = create<SettingsStore>()(
  subscribeWithSelector((set, get) => ({
    settings: loadSettings(),
    
    // ========== Terminal Settings ==========
    updateTerminal: (key, value) => {
      set((state) => {
        const newSettings: PersistedSettingsV2 = {
          ...state.settings,
          terminal: { ...state.settings.terminal, [key]: value },
        };
        persistSettings(newSettings);
        return { settings: newSettings };
      });
    },
    
    // ========== Buffer Settings ==========
    updateBuffer: (key, value) => {
      set((state) => {
        const newSettings: PersistedSettingsV2 = {
          ...state.settings,
          buffer: { ...state.settings.buffer, [key]: value },
        };
        persistSettings(newSettings);
        return { settings: newSettings };
      });
    },
    
    // ========== Appearance Settings ==========
    updateAppearance: (key, value) => {
      set((state) => {
        const newSettings: PersistedSettingsV2 = {
          ...state.settings,
          appearance: { ...state.settings.appearance, [key]: value },
        };
        persistSettings(newSettings);
        return { settings: newSettings };
      });
    },
    
    // ========== Connection Defaults ==========
    updateConnectionDefaults: (key, value) => {
      set((state) => {
        const newSettings: PersistedSettingsV2 = {
          ...state.settings,
          connectionDefaults: { ...state.settings.connectionDefaults, [key]: value },
        };
        persistSettings(newSettings);
        return { settings: newSettings };
      });
    },
    
    // ========== Tree UI State ==========
    setTreeExpanded: (ids) => {
      set((state) => {
        const newSettings: PersistedSettingsV2 = {
          ...state.settings,
          treeUI: { ...state.settings.treeUI, expandedIds: ids },
        };
        persistSettings(newSettings);
        return { settings: newSettings };
      });
    },
    
    toggleTreeNode: (nodeId) => {
      set((state) => {
        const current = new Set(state.settings.treeUI.expandedIds);
        if (current.has(nodeId)) {
          current.delete(nodeId);
        } else {
          current.add(nodeId);
        }
        const newSettings: PersistedSettingsV2 = {
          ...state.settings,
          treeUI: { ...state.settings.treeUI, expandedIds: [...current] },
        };
        persistSettings(newSettings);
        return { settings: newSettings };
      });
    },
    
    setFocusedNode: (nodeId) => {
      set((state) => {
        const newSettings: PersistedSettingsV2 = {
          ...state.settings,
          treeUI: { ...state.settings.treeUI, focusedNodeId: nodeId },
        };
        persistSettings(newSettings);
        return { settings: newSettings };
      });
    },
    
    // ========== Sidebar UI State ==========
    setSidebarCollapsed: (collapsed) => {
      set((state) => {
        const newSettings: PersistedSettingsV2 = {
          ...state.settings,
          sidebarUI: { ...state.settings.sidebarUI, collapsed },
        };
        persistSettings(newSettings);
        return { settings: newSettings };
      });
    },
    
    setSidebarSection: (section) => {
      set((state) => {
        const newSettings: PersistedSettingsV2 = {
          ...state.settings,
          sidebarUI: { ...state.settings.sidebarUI, activeSection: section },
        };
        persistSettings(newSettings);
        return { settings: newSettings };
      });
    },
    
    toggleSidebar: () => {
      set((state) => {
        const newSettings: PersistedSettingsV2 = {
          ...state.settings,
          sidebarUI: { 
            ...state.settings.sidebarUI, 
            collapsed: !state.settings.sidebarUI.collapsed 
          },
        };
        persistSettings(newSettings);
        return { settings: newSettings };
      });
    },
    
    // ========== Bulk Operations ==========
    resetToDefaults: () => {
      const newSettings = createDefaultSettings();
      persistSettings(newSettings);
      set({ settings: newSettings });
    },
    
    // ========== Selectors ==========
    getTerminal: () => get().settings.terminal,
    getBuffer: () => get().settings.buffer,
    getTreeUI: () => get().settings.treeUI,
    getSidebarUI: () => get().settings.sidebarUI,
  }))
);

// ============================================================================
// Event Subscriptions (Side Effects)
// ============================================================================

// Track previous renderer for Toast notification
let previousRenderer: RendererType | null = null;

// Subscribe to theme changes - apply to document
useSettingsStore.subscribe(
  (state) => state.settings.terminal.theme,
  (themeName) => {
    // Validate theme exists
    if (!themes[themeName]) {
      console.warn(`[SettingsStore] Theme "${themeName}" not found, falling back to default`);
      themeName = 'default';
    }
    
    // Set data-theme attribute for CSS variables
    document.documentElement.setAttribute('data-theme', themeName);
    
    // Dispatch event for terminal components to update their xterm instances
    window.dispatchEvent(
      new CustomEvent('global-theme-changed', {
        detail: {
          themeName,
          xtermTheme: themes[themeName],
        },
      })
    );
  }
);

// Subscribe to renderer changes - show Toast notification
useSettingsStore.subscribe(
  (state) => state.settings.terminal.renderer,
  (renderer) => {
    if (previousRenderer !== null && previousRenderer !== renderer) {
      // Show Toast notification for renderer change
      const rendererNames: Record<RendererType, string> = {
        auto: 'Auto',
        webgl: 'WebGL',
        canvas: 'Canvas',
      };
      
      useToastStore.getState().addToast({
        variant: 'default',
        title: '渲染器已更改',
        description: `终端渲染器已切换到 ${rendererNames[renderer]}。新终端将使用此渲染器，已打开的终端不受影响。`,
        duration: 5000,
      });
      
      console.debug(`[SettingsStore] Renderer changed: ${previousRenderer} -> ${renderer}`);
    }
    previousRenderer = renderer;
  }
);

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize settings on app startup.
 * Call this once in main.tsx or App.tsx.
 */
export function initializeSettings(): void {
  const { settings } = useSettingsStore.getState();
  
  // Apply theme immediately
  const themeName = themes[settings.terminal.theme] ? settings.terminal.theme : 'default';
  document.documentElement.setAttribute('data-theme', themeName);
  
  // Initialize previousRenderer for Toast tracking
  previousRenderer = settings.terminal.renderer;
  
  console.debug('[SettingsStore] Initialized with settings:', {
    theme: settings.terminal.theme,
    renderer: settings.terminal.renderer,
    sidebarCollapsed: settings.sidebarUI.collapsed,
  });
}

// ============================================================================
// Exports for External Use
// ============================================================================

export { createDefaultSettings, STORAGE_KEY, LEGACY_KEYS };
export type { SettingsStore };

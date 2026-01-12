/**
 * Layout Components - Barrel Export
 * 
 * Main layout infrastructure for OxideTerm:
 * - AppShell: Root layout with context provider
 * - Sidebar: Connection list and navigation
 * - TabBar: Session tabs with drag support
 * - BottomPanel: SFTP, transfers, port forwarding
 * - CommandPalette: Global command launcher
 */

// AppShell (root layout)
export { AppShell, useAppShell } from './AppShell';

// Sidebar
export {
  Sidebar,
  SidebarSection,
  ConnectionItem,
} from './Sidebar';

// TabBar
export { TabBar, TabContextMenu, type TabItem } from './TabBar';

// BottomPanel
export { BottomPanel, BottomPanelToggle } from './BottomPanel';

// CommandPalette
export { CommandPalette, CommandPaletteItem } from './CommandPalette';

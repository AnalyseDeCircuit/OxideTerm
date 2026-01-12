// Legacy exports (for backward compatibility during migration)
export { TitleBar } from './TitleBar';
export { ConnectModal } from './ConnectModal';
export { Sidebar } from './Sidebar';
export { TabBar } from './TabBar';
export { TerminalContainer, cleanupTerminalInstance, getTerminalInstance } from './TerminalContainer';
export { ConnectionList } from './ConnectionList';
export { ConnectionFormModal } from './ConnectionFormModal';
export { TerminalSearchBar } from './TerminalSearchBar';
export { TerminalContextMenu } from './TerminalContextMenu';
export { TerminalSettings } from './TerminalSettings';
export { SftpDrawer } from './SftpDrawer';
export { PortForwardingPanel } from './PortForwardingPanel';
export { ConnectionHealthIndicator, AllConnectionsHealth, useConnectionHealth } from './ConnectionHealthIndicator';

// New UI Components (Phase 1)
export * from './ui';

// New Layout Components (Phase 2)
export * from './layout';

// New Module Components (Phase 3)
export * from './connections';
export * from './terminal';
export * from './settings';
export * from './portforward';

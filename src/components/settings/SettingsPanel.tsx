/**
 * SettingsPanel Component
 * 
 * Unified settings panel with categorized sections.
 * Can be used in a Sheet or as a full page.
 */

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  Palette,
  Type,
  Terminal,
  Keyboard,
  Bell,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { Separator } from '@/components/ui/Separator';

type SettingsSection =
  | 'appearance'
  | 'font'
  | 'terminal'
  | 'keybindings'
  | 'notifications'
  | 'security';

interface SettingsPanelProps {
  defaultSection?: SettingsSection;
  className?: string;
}

const SECTIONS = [
  { id: 'appearance' as const, label: 'Appearance', icon: Palette },
  { id: 'font' as const, label: 'Font', icon: Type },
  { id: 'terminal' as const, label: 'Terminal', icon: Terminal },
  { id: 'keybindings' as const, label: 'Keybindings', icon: Keyboard },
  { id: 'notifications' as const, label: 'Notifications', icon: Bell },
  { id: 'security' as const, label: 'Security', icon: Shield },
];

export function SettingsPanel({
  defaultSection = 'terminal',
  className,
}: SettingsPanelProps) {
  const [activeSection, setActiveSection] =
    React.useState<SettingsSection>(defaultSection);

  return (
    <div className={cn('flex h-full', className)}>
      {/* Sidebar Navigation */}
      <div className="w-48 shrink-0 border-r border-surface-0 py-2">
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 text-text">
            <Settings size={16} />
            <span className="font-medium">Settings</span>
          </div>
        </div>
        <Separator className="my-2" />
        <nav className="px-2 space-y-0.5">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  'flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm',
                  'transition-colors',
                  isActive
                    ? 'bg-surface-0 text-text'
                    : 'text-subtext-1 hover:text-text hover:bg-surface-0/50'
                )}
              >
                <Icon size={14} />
                {section.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content Area */}
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-2xl">
          <SettingsContent section={activeSection} />
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================
// Settings Content Router
// ============================================

interface SettingsContentProps {
  section: SettingsSection;
}

function SettingsContent({ section }: SettingsContentProps) {
  switch (section) {
    case 'appearance':
      return <AppearanceSettings />;
    case 'font':
      return <FontSettings />;
    case 'terminal':
      return <TerminalSettingsSection />;
    case 'keybindings':
      return <KeybindingsSettings />;
    case 'notifications':
      return <NotificationsSettings />;
    case 'security':
      return <SecuritySettings />;
    default:
      return null;
  }
}

// ============================================
// Settings Sections
// ============================================

function AppearanceSettings() {
  return (
    <SettingsSection
      title="Appearance"
      description="Customize the look and feel of OxideTerm"
    >
      <SettingsGroup title="Theme">
        <p className="text-sm text-overlay-1">
          Theme settings will be integrated with TerminalSettings.
        </p>
      </SettingsGroup>
    </SettingsSection>
  );
}

function FontSettings() {
  return (
    <SettingsSection
      title="Font"
      description="Configure terminal font settings"
    >
      <SettingsGroup title="Font Family">
        <p className="text-sm text-overlay-1">
          Font settings will be integrated with TerminalSettings.
        </p>
      </SettingsGroup>
    </SettingsSection>
  );
}

function TerminalSettingsSection() {
  return (
    <SettingsSection
      title="Terminal"
      description="Configure terminal behavior"
    >
      <SettingsGroup title="Terminal Settings">
        <p className="text-sm text-overlay-1">
          Terminal settings are managed in the existing TerminalSettings component.
          This section will be fully integrated in Phase 4.
        </p>
      </SettingsGroup>
    </SettingsSection>
  );
}

function KeybindingsSettings() {
  const keybindings = [
    { key: '⌘K', action: 'Command Palette' },
    { key: '⌘B', action: 'Toggle Sidebar' },
    { key: '⌘J', action: 'Toggle Bottom Panel' },
    { key: '⌘,', action: 'Open Settings' },
    { key: '⌘N', action: 'New Connection' },
    { key: '⌘T', action: 'New Tab' },
    { key: '⌘W', action: 'Close Tab' },
    { key: '⌘1-9', action: 'Switch to Tab N' },
    { key: '⌘[/]', action: 'Previous/Next Tab' },
    { key: '⌘F', action: 'Terminal Search' },
  ];

  return (
    <SettingsSection
      title="Keybindings"
      description="Keyboard shortcuts reference"
    >
      <div className="space-y-1">
        {keybindings.map((kb) => (
          <div
            key={kb.key}
            className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-surface-0/50"
          >
            <span className="text-sm text-text">{kb.action}</span>
            <kbd className="px-2 py-1 text-xs bg-surface-0 rounded text-overlay-1">
              {kb.key}
            </kbd>
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}

function NotificationsSettings() {
  return (
    <SettingsSection
      title="Notifications"
      description="Configure notification preferences"
    >
      <SettingsGroup title="Alerts">
        <p className="text-sm text-overlay-1">
          Notification settings coming in a future update.
        </p>
      </SettingsGroup>
    </SettingsSection>
  );
}

function SecuritySettings() {
  return (
    <SettingsSection
      title="Security"
      description="Security and privacy settings"
    >
      <SettingsGroup title="SSH Keys">
        <p className="text-sm text-overlay-1">
          SSH key management coming in a future update.
        </p>
      </SettingsGroup>
    </SettingsSection>
  );
}

// ============================================
// Shared Components
// ============================================

interface SettingsSectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-text">{title}</h2>
        <p className="text-sm text-overlay-1 mt-1">{description}</p>
      </div>
      <div className="space-y-6">{children}</div>
    </motion.div>
  );
}

interface SettingsGroupProps {
  title: string;
  children: React.ReactNode;
}

function SettingsGroup({ title, children }: SettingsGroupProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-subtext-1 uppercase tracking-wider">
        {title}
      </h3>
      {children}
    </div>
  );
}

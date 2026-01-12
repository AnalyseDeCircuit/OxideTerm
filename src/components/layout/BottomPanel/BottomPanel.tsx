/**
 * BottomPanel Component
 * 
 * Resizable bottom panel for SFTP, Port Forwarding, and other tools.
 * VSCode-style collapsible panel with tabs.
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronUp,
  FolderOpen,
  ArrowUpDown,
  Network,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAppShell } from '../AppShell';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

type PanelTab = 'sftp' | 'transfers' | 'portforward';

interface BottomPanelProps {
  children?: React.ReactNode;
  className?: string;
  sftpContent?: React.ReactNode;
  transfersContent?: React.ReactNode;
  portForwardContent?: React.ReactNode;
  transferCount?: number;
  forwardCount?: number;
}

const MIN_HEIGHT = 150;
const MAX_HEIGHT_RATIO = 0.6; // 60% of window height

export function BottomPanel({
  className,
  sftpContent,
  transfersContent,
  portForwardContent,
  transferCount = 0,
  forwardCount = 0,
}: BottomPanelProps) {
  const {
    bottomPanelOpen,
    setBottomPanelOpen,
    bottomPanelHeight,
    setBottomPanelHeight,
  } = useAppShell();

  const [activeTab, setActiveTab] = React.useState<PanelTab>('sftp');
  const [isMaximized, setIsMaximized] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const startY = React.useRef(0);
  const startHeight = React.useRef(0);

  // Handle resize drag
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startY.current = e.clientY;
    startHeight.current = bottomPanelHeight;
  };

  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = startY.current - e.clientY;
      const newHeight = Math.max(
        MIN_HEIGHT,
        Math.min(
          window.innerHeight * MAX_HEIGHT_RATIO,
          startHeight.current + deltaY
        )
      );
      setBottomPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, setBottomPanelHeight]);

  const currentHeight = isMaximized
    ? window.innerHeight * 0.7
    : bottomPanelHeight;

  const tabs: { id: PanelTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'sftp', label: 'SFTP', icon: <FolderOpen size={14} /> },
    {
      id: 'transfers',
      label: 'Transfers',
      icon: <ArrowUpDown size={14} />,
      count: transferCount,
    },
    {
      id: 'portforward',
      label: 'Port Forward',
      icon: <Network size={14} />,
      count: forwardCount,
    },
  ];

  return (
    <AnimatePresence>
      {bottomPanelOpen && (
        <motion.div
          ref={panelRef}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: currentHeight, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'flex flex-col shrink-0 bg-panel-bg border-t border-panel-border',
            'overflow-hidden',
            className
          )}
        >
          {/* Resize Handle */}
          <div
            onMouseDown={handleMouseDown}
            className={cn(
              'h-1 cursor-ns-resize flex items-center justify-center',
              'hover:bg-mauve/20 transition-colors',
              isDragging && 'bg-mauve/30'
            )}
          >
            <div className="w-8 h-0.5 rounded-full bg-surface-1" />
          </div>

          {/* Tab Header */}
          <div className="flex items-center justify-between px-2 py-1 border-b border-surface-0">
            {/* Tabs */}
            <div className="flex items-center gap-0.5">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium',
                    'transition-colors duration-fast',
                    activeTab === tab.id
                      ? 'bg-surface-0 text-text'
                      : 'text-subtext-1 hover:text-text hover:bg-surface-0/50'
                  )}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <Badge variant="primary" size="sm">
                      {tab.count}
                    </Badge>
                  )}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsMaximized(!isMaximized)}
                className="text-overlay-1 hover:text-text"
              >
                {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setBottomPanelOpen(false)}
                className="text-overlay-1 hover:text-text"
              >
                <X size={12} />
              </Button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="h-full"
              >
                {activeTab === 'sftp' && sftpContent}
                {activeTab === 'transfers' && transfersContent}
                {activeTab === 'portforward' && portForwardContent}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Toggle button for when panel is closed
interface BottomPanelToggleProps {
  className?: string;
}

export function BottomPanelToggle({ className }: BottomPanelToggleProps) {
  const { bottomPanelOpen, setBottomPanelOpen } = useAppShell();

  if (bottomPanelOpen) return null;

  return (
    <div
      className={cn(
        'flex items-center justify-center py-1 border-t border-surface-0',
        'bg-mantle cursor-pointer hover:bg-surface-0/50 transition-colors',
        className
      )}
      onClick={() => setBottomPanelOpen(true)}
    >
      <ChevronUp size={14} className="text-overlay-1" />
    </div>
  );
}

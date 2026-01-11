/**
 * SftpDrawer Component
 * 
 * Slide-in panel from the right side for SFTP file management.
 * Overlays on top of the terminal without navigating away.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { FileExplorer } from './sftp/FileExplorer';
import { PreviewModal } from './sftp/PreviewModal';
import { TransferQueue } from './sftp/TransferQueue';

interface SftpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
  hostName?: string;
}

const MIN_WIDTH = 320;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 400;

export function SftpDrawer({ isOpen, onClose, sessionId, hostName }: SftpDrawerProps) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Handle resize
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - e.clientX));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!sessionId) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`
          fixed inset-0 bg-black/30 backdrop-blur-sm z-40
          transition-opacity duration-300
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`
          fixed top-[38px] right-0 bottom-0 z-50
          flex flex-col
          transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        style={{ 
          width,
          background: 'var(--sidebar-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderLeft: '1px solid var(--color-surface-0)'
        }}
      >
        {/* Resize Handle */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue/50 transition-colors"
          onMouseDown={startResizing}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-0/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text">Remote Files</h2>
              <p className="text-xs text-overlay-0 font-mono">{hostName || 'Unknown Host'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-overlay-1 hover:text-text hover:bg-surface-0/50 rounded-md transition-colors"
            title="Close (Esc)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* File Explorer */}
        <div className="flex-1 overflow-hidden">
          <FileExplorer sessionId={sessionId} />
        </div>

        {/* Transfer Queue */}
        <TransferQueue />
      </div>

      {/* Preview Modal */}
      <PreviewModal />
    </>
  );
}

export default SftpDrawer;

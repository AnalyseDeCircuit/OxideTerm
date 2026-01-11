/**
 * SftpDrawer Component
 * 
 * Slide-in panel from the right side for SFTP file management.
 * Overlays on top of the terminal without navigating away.
 */

import { useState, useRef, useEffect, useCallback } from 'react';

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

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-surface-0/50">
          <button className="btn btn-ghost btn-icon text-xs" title="Upload">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </button>
          <button className="btn btn-ghost btn-icon text-xs" title="Download">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          <button className="btn btn-ghost btn-icon text-xs" title="Refresh">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <div className="flex-1" />
          <button className="btn btn-ghost btn-icon text-xs" title="New Folder">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
          </button>
        </div>

        {/* Path Bar */}
        <div className="flex items-center gap-2 px-4 py-2 bg-surface-0/30">
          <svg className="w-4 h-4 text-overlay-0 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <input
            type="text"
            defaultValue="/home/user"
            className="flex-1 px-2 py-1 text-sm font-mono bg-transparent border-none outline-none text-text placeholder-overlay-0"
            placeholder="/path/to/directory"
          />
        </div>

        {/* File List (Placeholder) */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 rounded-full bg-surface-0/50 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-overlay-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm text-overlay-1 mb-2">SFTP Coming Soon</p>
            <p className="text-xs text-overlay-0 max-w-[200px]">
              File browser with upload/download will be available in Week 7
            </p>
          </div>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-surface-0/50 text-xs text-overlay-0">
          <span>0 items</span>
          <span>SFTP</span>
        </div>
      </div>
    </>
  );
}

export default SftpDrawer;

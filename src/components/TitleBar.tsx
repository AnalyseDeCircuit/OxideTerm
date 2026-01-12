/**
 * TitleBar Component
 * 
 * macOS-style custom titlebar with traffic light buttons.
 * Supports frameless window dragging via Tauri.
 */

import { useState, useEffect, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface TitleBarProps {
  title?: string;
  subtitle?: string;
  showTrafficLights?: boolean;
}

export function TitleBar({ 
  title = 'OxideTerm', 
  subtitle,
  showTrafficLights = true 
}: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFocused, setIsFocused] = useState(true);

  // Check window state on mount and listen for changes
  useEffect(() => {
    const appWindow = getCurrentWindow();
    
    const checkMaximized = async () => {
      const maximized = await appWindow.isMaximized();
      setIsMaximized(maximized);
    };
    
    checkMaximized();
    
    // Listen for window focus/blur
    const unlistenFocus = appWindow.onFocusChanged(({ payload: focused }) => {
      setIsFocused(focused);
    });

    // Listen for resize events to update maximized state
    const unlistenResize = appWindow.onResized(() => {
      checkMaximized();
    });

    return () => {
      unlistenFocus.then(fn => fn());
      unlistenResize.then(fn => fn());
    };
  }, []);

  const handleClose = useCallback(async () => {
    const appWindow = getCurrentWindow();
    await appWindow.close();
  }, []);

  const handleMinimize = useCallback(async () => {
    const appWindow = getCurrentWindow();
    await appWindow.minimize();
  }, []);

  const handleMaximize = useCallback(async () => {
    const appWindow = getCurrentWindow();
    if (isMaximized) {
      await appWindow.unmaximize();
    } else {
      await appWindow.maximize();
    }
    setIsMaximized(!isMaximized);
  }, [isMaximized]);

  return (
    <div 
      className="h-[32px] flex items-center justify-between select-none shrink-0"
      style={{ 
        background: 'var(--mantle)',
        borderBottom: '1px solid var(--surface1)'
      }}
      data-tauri-drag-region
    >
      {/* Left: Traffic Lights */}
      <div className="flex items-center h-full px-4">
         {/* Native-like overlay (handled by OS or custom if needed, here keeping structure) */}
         <div className="w-14" />
      </div>

      {/* Center: Title - Monospace industrial */}
      <div 
        className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2 font-mono"
        data-tauri-drag-region
      >
        <span className="text-xs font-bold text-subtext-0 tracking-widest uppercase opacity-80">{title}</span>
        {subtitle && (
           <>
            <span className="text-overlay-1">//</span>
            <span className="text-[10px] text-overlay-1 uppercase">{subtitle}</span>
           </>
        )}
      </div>

      {/* Right: Spacer for symmetry */}
      <div className="w-[70px]" />
    </div>
  );
}

interface TrafficLightsProps {
  isFocused: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
}

function TrafficLights({ isFocused, onClose, onMinimize, onMaximize }: TrafficLightsProps) {
  const [isHovered, setIsHovered] = useState(false);

  const buttonClass = `
    w-3 h-3 rounded-full transition-all duration-150
    flex items-center justify-center
    focus:outline-none
  `;

  return (
    <div 
      className={`traffic-lights ${!isFocused ? 'inactive' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Close */}
      <button
        className={`${buttonClass} traffic-light close`}
        onClick={onClose}
        title="Close"
      >
        {isHovered && isFocused && (
          <svg className="w-2 h-2" viewBox="0 0 10 10" fill="none">
            <path d="M2 2L8 8M8 2L2 8" stroke="#4c0519" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        )}
      </button>

      {/* Minimize */}
      <button
        className={`${buttonClass} traffic-light minimize`}
        onClick={onMinimize}
        title="Minimize"
      >
        {isHovered && isFocused && (
          <svg className="w-2 h-2" viewBox="0 0 10 10" fill="none">
            <path d="M2 5H8" stroke="#713f12" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        )}
      </button>

      {/* Maximize */}
      <button
        className={`${buttonClass} traffic-light maximize`}
        onClick={onMaximize}
        title="Maximize"
      >
        {isHovered && isFocused && (
          <svg className="w-2 h-2" viewBox="0 0 10 10" fill="none">
            <path d="M2 3.5C2 2.67157 2.67157 2 3.5 2H6.5C7.32843 2 8 2.67157 8 3.5V6.5C8 7.32843 7.32843 8 6.5 8H3.5C2.67157 8 2 7.32843 2 6.5V3.5Z" stroke="#14532d" strokeWidth="1.5"/>
          </svg>
        )}
      </button>
    </div>
  );
}

export default TitleBar;

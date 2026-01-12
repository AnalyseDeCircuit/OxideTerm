import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { useAppStore } from '../../store/appStore';

interface TerminalViewProps {
  sessionId: string;
}

export const TerminalView: React.FC<TerminalViewProps> = ({ sessionId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  
  const { getSession, updateSessionState } = useAppStore();
  const session = getSession(sessionId);

  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;

    // Initialize xterm.js
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: '"JetBrains Mono", "SF Mono", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      theme: {
        background: '#09090b', // oxide-bg
        foreground: '#f4f4f5', // oxide-text
        cursor: '#ea580c',     // oxide-accent
        selectionBackground: 'rgba(234, 88, 12, 0.3)',
        black: '#09090b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#d946ef',
        cyan: '#06b6d4',
        white: '#f4f4f5',
        brightBlack: '#71717a',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#e879f9',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();
    
    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.loadAddon(webLinksAddon);

    // Try WebGL, fallback to canvas/dom if needed
    try {
        const webglAddon = new WebglAddon();
        webglAddon.onContextLoss(e => {
            webglAddon.dispose();
        });
        term.loadAddon(webglAddon);
    } catch (e) {
        console.warn("WebGL addon failed to load", e);
    }

    term.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln(`\x1b[32mWelcome to OxideTerm\x1b[0m`);
    term.writeln(`Connecting to ${session?.username}@${session?.host}...`);

    // MOCK Backend Connection
    // In real implementation, we would connect to WebSocket URL from session info
    // const ws = new WebSocket(session?.ws_url); ...
    
    let mockInterval: any;
    
    const startMockSession = () => {
       term.writeln("Connected.");
       term.write(`\r\n${session?.username}@${session?.host}:~$ `);
       
       term.onData(data => {
          // Echo back for now (local echo simulation)
          if (data === '\r') {
             term.write('\r\n');
             term.write(`${session?.username}@${session?.host}:~$ `);
          } else if (data === '\u007F') { // Backspace
             term.write('\b \b');
          } else {
             term.write(data);
          }
       });
    };

    // Simulate connection delay
    setTimeout(startMockSession, 500);

    // Handle Resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        // TODO: Send resize to backend
        // invoke('resize_session_v2', { sessionId, cols: term.cols, rows: term.rows });
      }
    };

    window.addEventListener('resize', handleResize);
    
    // Initial fit after a small delay to ensure container has size
    setTimeout(() => {
        fitAddon.fit();
    }, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mockInterval) clearInterval(mockInterval);
      term.dispose();
      terminalRef.current = null;
    };
  }, [sessionId, session]); // Re-run if sessionId changes (shouldn't happen for same component instance ideally)

  // Re-fit when visible (handled by ResizeObserver in a real robust app, but window resize is ok for now)

  return (
    <div className="h-full w-full bg-oxide-bg p-1 overflow-hidden">
       <div ref={containerRef} className="h-full w-full" />
    </div>
  );
};

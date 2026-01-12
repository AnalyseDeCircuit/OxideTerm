import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { useAppStore } from '../../store/appStore';
import { api } from '../../lib/api';

interface TerminalViewProps {
  sessionId: string;
}

// Protocol Constants
const MSG_TYPE_DATA = 0x00;
const MSG_TYPE_RESIZE = 0x01;

export const TerminalView: React.FC<TerminalViewProps> = ({ sessionId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isMountedRef = useRef(true); // Track mount state for StrictMode
  
  const { getSession } = useAppStore();
  const session = getSession(sessionId);

  // Load Settings
  const [settings, setSettings] = useState(() => {
        const saved = localStorage.getItem('oxide-settings');
        return saved ? JSON.parse(saved) : {
            theme: 'default',
            fontFamily: 'jetbrains',
            fontSize: 14,
            cursorStyle: 'block',
            cursorBlink: true
        };
  });

  // Listen for settings changes
  useEffect(() => {
    const handleSettingsChange = (e: CustomEvent) => {
        setSettings(e.detail);
        if (terminalRef.current) {
            terminalRef.current.options.fontFamily = getFontFamily(e.detail.fontFamily);
            terminalRef.current.options.fontSize = e.detail.fontSize;
            terminalRef.current.options.cursorStyle = e.detail.cursorStyle;
            terminalRef.current.options.cursorBlink = e.detail.cursorBlink;
            terminalRef.current.refresh(0, terminalRef.current.rows - 1);
            fitAddonRef.current?.fit();
        }
    };
    window.addEventListener('settings-changed', handleSettingsChange as EventListener);
    return () => window.removeEventListener('settings-changed', handleSettingsChange as EventListener);
  }, []);

  const getFontFamily = (val: string) => {
      switch(val) {
          case 'jetbrains': return '"JetBrains Mono", "SF Mono", monospace';
          case 'sfmono': return '"SF Mono", "Fira Code", monospace';
          case 'fira': return '"Fira Code", monospace';
          default: return 'monospace';
      }
  };

  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;
    
    isMountedRef.current = true; // Reset mount state

    // Initialize xterm.js
    const term = new Terminal({
      cursorBlink: settings.cursorBlink,
      cursorStyle: settings.cursorStyle,
      fontFamily: getFontFamily(settings.fontFamily),
      fontSize: settings.fontSize,
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

    term.writeln(`\x1b[32mInitialized OxideTerm v0.1\x1b[0m`);
    
    // Delay WebSocket connection to avoid React StrictMode double-mount issue
    let wsConnectTimeout: ReturnType<typeof setTimeout> | null = null;
    
    if (session?.ws_url) {
        const wsUrl = session.ws_url; // Capture to avoid undefined in closure
        term.writeln(`Connecting to ${session.username}@${session.host}...`);
        
        wsConnectTimeout = setTimeout(() => {
            if (!isMountedRef.current) return; // Check if still mounted after delay
            
            try {
                const ws = new WebSocket(wsUrl);
                ws.binaryType = 'arraybuffer';
                wsRef.current = ws;

                ws.onopen = () => {
                    if (!isMountedRef.current) {
                        ws.close();
                        return;
                    }
                    term.writeln("Connected.\r\n");
                    // Initial resize
                    const cols = term.cols;
                    const rows = term.rows;
                    sendResize(ws, cols, rows);
                };

                ws.onmessage = (event) => {
                    if (!isMountedRef.current) return;
                    const data = event.data;
                    if (data instanceof ArrayBuffer) {
                        const view = new Uint8Array(data);
                        const type = view[0];
                        const payload = view.subarray(1);

                        if (type === MSG_TYPE_DATA) {
                            term.write(payload);
                        }
                    }
                };

                ws.onclose = () => {
                    if (!isMountedRef.current) return;
                    term.writeln("\r\n\x1b[31mConnection closed.\x1b[0m");
                };

                ws.onerror = (e) => {
                    if (!isMountedRef.current) return;
                    term.writeln(`\r\n\x1b[31mWebSocket error: ${e}\x1b[0m`);
                };



            } catch (e) {
                term.writeln(`\r\n\x1b[31mFailed to establish WebSocket: ${e}\x1b[0m`);
            }
        }, 100); // 100ms delay to let StrictMode unmount/remount complete
    } else {
         term.writeln(`\x1b[33mNo WebSocket URL available for session.\x1b[0m`);
    }

    // Terminal Input -> WebSocket (registered outside setTimeout to work immediately)
    term.onData(data => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            // Frame: [0x00][bytes...]
            const encoder = new TextEncoder();
            const payload = encoder.encode(data);
            const frame = new Uint8Array(1 + payload.length);
            frame[0] = MSG_TYPE_DATA;
            frame.set(payload, 1);
            ws.send(frame);
        }
    });

    term.onResize((size) => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            sendResize(ws, size.cols, size.rows);
            api.resizeSession(sessionId, size.cols, size.rows);
        }
    });

    // Handle Window Resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };

    window.addEventListener('resize', handleResize);
    
    // Initial fit
    setTimeout(() => {
        fitAddon.fit();
    }, 100);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('resize', handleResize);
      if (wsConnectTimeout) {
          clearTimeout(wsConnectTimeout);
      }
      if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
      }
      term.dispose();
      terminalRef.current = null;
    };
  }, [sessionId]); // Only re-mount if sessionId changes absolutely

  const sendResize = (ws: WebSocket, cols: number, rows: number) => {
      const buffer = new ArrayBuffer(5); // 1 type + 2 cols + 2 rows
      const view = new DataView(buffer);
      view.setUint8(0, MSG_TYPE_RESIZE);
      view.setUint16(1, cols, false); // Big Endian
      view.setUint16(3, rows, false);
      ws.send(buffer);
  };

  return (
    <div className="h-full w-full bg-oxide-bg p-1 overflow-hidden">
       <div ref={containerRef} className="h-full w-full" />
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { useAppStore } from '../../store/appStore';
import { api } from '../../lib/api';
import { themes } from '../../lib/themes';

interface TerminalViewProps {
  sessionId: string;
  isActive?: boolean;
}

// Protocol Constants - Wire Protocol v1
// Frame Format: [Type: 1 byte][Length: 4 bytes big-endian][Payload: n bytes]
const MSG_TYPE_DATA = 0x00;
const MSG_TYPE_RESIZE = 0x01;
const MSG_TYPE_HEARTBEAT = 0x02;
const MSG_TYPE_ERROR = 0x03;
const HEADER_SIZE = 5; // 1 byte type + 4 bytes length

// Helper function to encode a heartbeat response frame
const encodeHeartbeatFrame = (seq: number): Uint8Array => {
  const frame = new Uint8Array(HEADER_SIZE + 4); // 4 bytes for sequence number
  const view = new DataView(frame.buffer);
  view.setUint8(0, MSG_TYPE_HEARTBEAT);  // Type
  view.setUint32(1, 4, false);           // Length (4 bytes payload)
  view.setUint32(5, seq, false);         // Sequence number (big-endian)
  return frame;
};

// Helper function to encode a data frame
const encodeDataFrame = (payload: Uint8Array): Uint8Array => {
  const frame = new Uint8Array(HEADER_SIZE + payload.length);
  const view = new DataView(frame.buffer);
  view.setUint8(0, MSG_TYPE_DATA);           // Type
  view.setUint32(1, payload.length, false);  // Length (big-endian)
  frame.set(payload, HEADER_SIZE);           // Payload
  return frame;
};

// Helper function to encode a resize frame
const encodeResizeFrame = (cols: number, rows: number): Uint8Array => {
  const frame = new Uint8Array(HEADER_SIZE + 4); // 4 bytes for cols + rows
  const view = new DataView(frame.buffer);
  view.setUint8(0, MSG_TYPE_RESIZE);  // Type
  view.setUint32(1, 4, false);        // Length (4 bytes payload)
  view.setUint16(5, cols, false);     // Cols (big-endian)
  view.setUint16(7, rows, false);     // Rows (big-endian)
  return frame;
};

export const TerminalView: React.FC<TerminalViewProps> = ({ sessionId, isActive = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isMountedRef = useRef(true); // Track mount state for StrictMode
  
  // P3: Backpressure handling - batch terminal writes with RAF
  const pendingDataRef = useRef<Uint8Array[]>([]);
  const rafIdRef = useRef<number | null>(null);
  
  // Track last connected ws_url for reconnection detection
  const lastWsUrlRef = useRef<string | null>(null);
  
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
            terminalRef.current.options.lineHeight = e.detail.lineHeight;
            
            // Apply theme update - use the theme setter for type-safe assignment
            const themeConfig = themes[e.detail.theme] || themes.default;
            terminalRef.current.options.theme = themeConfig;
            
            terminalRef.current.refresh(0, terminalRef.current.rows - 1);
            fitAddonRef.current?.fit();
        }
    };
    window.addEventListener('settings-changed', handleSettingsChange as EventListener);
    return () => window.removeEventListener('settings-changed', handleSettingsChange as EventListener);
  }, []);

  // Focus terminal when it becomes active (tab switch)
  useEffect(() => {
    if (isActive && terminalRef.current) {
      // Small delay to ensure DOM is ready
      const focusTimeout = setTimeout(() => {
        terminalRef.current?.focus();
        fitAddonRef.current?.fit();
      }, 50);
      return () => clearTimeout(focusTimeout);
    }
  }, [isActive]);

  // WebSocket reconnection effect - triggers when ws_url changes (after auto-reconnect)
  useEffect(() => {
    // Skip if terminal not initialized or no ws_url
    if (!terminalRef.current || !session?.ws_url) return;
    
    // Skip if this is the same URL we're already connected to
    if (session.ws_url === lastWsUrlRef.current) return;
    
    // Skip if WebSocket is already open/connecting to same URL
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
      // If old connection exists but URL changed, close it
      if (lastWsUrlRef.current !== null && session.ws_url !== lastWsUrlRef.current) {
        console.log('[Terminal] Session reconnected, closing old WebSocket and reconnecting...');
        wsRef.current.close();
      } else {
        return; // Same URL, already connected
      }
    }
    
    const term = terminalRef.current;
    const wsUrl = session.ws_url;
    const wsToken = session.ws_token;
    
    term.writeln(`\r\n\x1b[33mReconnecting to ${session.username}@${session.host}...\x1b[0m`);
    
    try {
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;
      lastWsUrlRef.current = wsUrl;

      ws.onopen = () => {
        if (!isMountedRef.current) {
          ws.close();
          return;
        }
        
        // Send authentication token
        if (wsToken) {
          ws.send(wsToken);
        }
        
        term.writeln(`\x1b[32mReconnected successfully!\x1b[0m\r\n`);
        
        // Re-send current terminal size
        if (fitAddonRef.current) {
          const dims = fitAddonRef.current.proposeDimensions();
          if (dims) {
            const frame = encodeResizeFrame(dims.cols, dims.rows);
            ws.send(frame);
          }
        }
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        
        const data = new Uint8Array(event.data);
        if (data.length < HEADER_SIZE) return;
        
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        const msgType = view.getUint8(0);
        const length = view.getUint32(1, false);
        
        if (data.length < HEADER_SIZE + length) return;
        
        const payload = data.slice(HEADER_SIZE, HEADER_SIZE + length);
        
        switch (msgType) {
          case MSG_TYPE_DATA:
            pendingDataRef.current.push(payload);
            if (rafIdRef.current === null) {
              rafIdRef.current = requestAnimationFrame(() => {
                if (pendingDataRef.current.length > 0 && terminalRef.current) {
                  const combined = new Uint8Array(
                    pendingDataRef.current.reduce((acc, arr) => acc + arr.length, 0)
                  );
                  let offset = 0;
                  for (const chunk of pendingDataRef.current) {
                    combined.set(chunk, offset);
                    offset += chunk.length;
                  }
                  pendingDataRef.current = [];
                  terminalRef.current.write(combined);
                }
                rafIdRef.current = null;
              });
            }
            break;
          case MSG_TYPE_HEARTBEAT:
            if (payload.length >= 4) {
              const seq = view.getUint32(HEADER_SIZE, false);
              ws.send(encodeHeartbeatFrame(seq));
            }
            break;
          case MSG_TYPE_ERROR:
            const errorMsg = new TextDecoder().decode(payload);
            term.writeln(`\r\n\x1b[31mServer error: ${errorMsg}\x1b[0m`);
            break;
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket reconnection error:', error);
        term.writeln(`\r\n\x1b[31mWebSocket reconnection error\x1b[0m`);
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed after reconnect:', event.code, event.reason);
        if (isMountedRef.current && event.code !== 1000) {
          term.writeln(`\r\n\x1b[33mConnection closed (code: ${event.code})\x1b[0m`);
        }
      };
    } catch (e) {
      console.error('Failed to reconnect WebSocket:', e);
      term.writeln(`\r\n\x1b[31mFailed to reconnect: ${e}\x1b[0m`);
    }
  }, [session?.ws_url, session?.ws_token, session?.username, session?.host]);

  const getFontFamily = (val: string) => {
      switch(val) {
          case 'jetbrains': return '"JetBrains Mono", monospace';
          case 'meslo': return '"MesloLGM Nerd Font", monospace';
          case 'tinos': return '"Tinos Nerd Font", monospace';
          default: return '"JetBrains Mono", monospace';
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
      theme: themes[settings.theme] || themes.default,
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
        // Configure WebGL with explicit DPR for crisp HiDPI rendering
        const dpr = Math.ceil(window.devicePixelRatio || 1);
        const webglAddon = new WebglAddon();
        webglAddon.onContextLoss(() => {
            webglAddon.dispose();
        });
        term.loadAddon(webglAddon);
        console.log(`WebGL addon loaded with DPR: ${dpr}`);
    } catch (e) {
        console.warn("WebGL addon failed to load, falling back to canvas renderer", e);
    }

    term.open(containerRef.current);
    fitAddon.fit();
    term.focus(); // Focus immediately after opening

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln(`\x1b[38;2;234;88;12mInitialized OxideTerm\x1b[0m`);
    
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
                lastWsUrlRef.current = wsUrl; // Track initial ws_url

                ws.onopen = () => {
                    if (!isMountedRef.current) {
                        ws.close();
                        return;
                    }
                    
                    // SECURITY: Send authentication token as first message
                    if (session?.ws_token) {
                        ws.send(session.ws_token);
                    } else {
                        console.warn('No WebSocket token available - authentication may fail');
                    }
                    
                    term.writeln("Connected.\r\n");
                    // Initial resize using Wire Protocol v1
                    const frame = encodeResizeFrame(term.cols, term.rows);
                    ws.send(frame);
                    // Focus terminal after connection
                    term.focus();
                };

                ws.onmessage = (event) => {
                    if (!isMountedRef.current) return;
                    const data = event.data;
                    if (data instanceof ArrayBuffer) {
                        // Parse Wire Protocol v1 frame: [Type: 1][Length: 4][Payload: n]
                        const view = new DataView(data);
                        if (data.byteLength < HEADER_SIZE) return;
                        
                        const type = view.getUint8(0);
                        const length = view.getUint32(1, false); // big-endian
                        
                        if (data.byteLength < HEADER_SIZE + length) return;
                        
                        if (type === MSG_TYPE_DATA) {
                            const payload = new Uint8Array(data, HEADER_SIZE, length);
                            // P3: Queue data and batch writes with RAF for backpressure handling
                            pendingDataRef.current.push(payload);
                            
                            // Schedule RAF flush if not already scheduled
                            if (rafIdRef.current === null) {
                                rafIdRef.current = requestAnimationFrame(() => {
                                    rafIdRef.current = null;
                                    if (!isMountedRef.current || !terminalRef.current) return;
                                    
                                    // Flush all pending data in one batch
                                    const pending = pendingDataRef.current;
                                    if (pending.length === 0) return;
                                    
                                    // Concatenate all chunks for single write
                                    const totalLength = pending.reduce((sum, chunk) => sum + chunk.length, 0);
                                    const combined = new Uint8Array(totalLength);
                                    let offset = 0;
                                    for (const chunk of pending) {
                                        combined.set(chunk, offset);
                                        offset += chunk.length;
                                    }
                                    
                                    pendingDataRef.current = [];
                                    terminalRef.current.write(combined);
                                });
                            }
                        } else if (type === MSG_TYPE_HEARTBEAT) {
                            // Heartbeat ping from server - respond with pong
                            if (length === 4) {
                                const seq = view.getUint32(HEADER_SIZE, false); // big-endian
                                const response = encodeHeartbeatFrame(seq);
                                ws.send(response);
                            }
                        } else if (type === MSG_TYPE_ERROR) {
                            // Error message from backend - display in terminal
                            const payload = new Uint8Array(data, HEADER_SIZE, length);
                            const decoder = new TextDecoder('utf-8');
                            const errorMsg = decoder.decode(payload);
                            term.writeln(`\r\n\x1b[31mServer error: ${errorMsg}\x1b[0m`);
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
            // Encode as Wire Protocol v1 Data frame
            const encoder = new TextEncoder();
            const payload = encoder.encode(data);
            const frame = encodeDataFrame(payload);
            ws.send(frame);
        }
    });

    term.onResize((size) => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            // Send resize frame using Wire Protocol v1
            const frame = encodeResizeFrame(size.cols, size.rows);
            ws.send(frame);
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
      // Cancel pending RAF
      if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
      }
      pendingDataRef.current = [];
      if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
      }
      term.dispose();
      terminalRef.current = null;
    };
  }, [sessionId]); // Only re-mount if sessionId changes absolutely

  const handleContainerClick = () => {
    terminalRef.current?.focus();
  };

  const currentTheme = themes[settings.theme] || themes.default;
  
  return (
    <div 
      className="terminal-container h-full w-full overflow-hidden" 
      style={{ 
        padding: '4px',
        backgroundColor: currentTheme.background 
      }}
      onClick={handleContainerClick}
    >
       <div 
         ref={containerRef} 
         className="h-full w-full"
         style={{
           contain: 'strict',
           isolation: 'isolate'
         }}
       />
    </div>
  );
};

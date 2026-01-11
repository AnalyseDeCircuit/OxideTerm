import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';
import { 
  encodeFrame, 
  dataFrame, 
  resizeFrame, 
  heartbeatFrame,
  FrameDecoder, 
  MessageType,
  type Frame 
} from '../lib/protocol';
import { useSessionStore } from '../store/sessionStore';

interface TerminalViewProps {
  wsUrl: string | null;
  sessionId: string;
  isActive: boolean;
}

// Heartbeat interval (should match backend)
const HEARTBEAT_INTERVAL_MS = 30_000;
// Debounce delay for resize events
const RESIZE_DEBOUNCE_MS = 150;

export function TerminalView({ wsUrl, sessionId, isActive }: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const webSocket = useRef<WebSocket | null>(null);
  const decoder = useRef<FrameDecoder>(new FrameDecoder());
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatSeq = useRef<number>(0);
  const resizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSize = useRef<{ cols: number; rows: number } | null>(null);
  
  const updateSessionStatus = useSessionStore((state) => state.updateSessionStatus);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current || terminalInstance.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
      theme: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc',
        cursorAccent: '#1e1e2e',
        selectionBackground: '#585b70',
        selectionForeground: '#cdd6f4',
        black: '#45475a',
        red: '#f38ba8',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        blue: '#89b4fa',
        magenta: '#f5c2e7',
        cyan: '#94e2d5',
        white: '#bac2de',
        brightBlack: '#585b70',
        brightRed: '#f38ba8',
        brightGreen: '#a6e3a1',
        brightYellow: '#f9e2af',
        brightBlue: '#89b4fa',
        brightMagenta: '#f5c2e7',
        brightCyan: '#94e2d5',
        brightWhite: '#a6adc8',
      },
      allowProposedApi: true,
    });

    // Load fit addon
    const fit = new FitAddon();
    fitAddon.current = fit;
    term.loadAddon(fit);

    // Open terminal in container
    term.open(terminalRef.current);

    // Try to load WebGL addon for GPU acceleration
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => {
        webgl.dispose();
      });
      term.loadAddon(webgl);
      console.log('WebGL addon loaded');
    } catch (e) {
      console.warn('WebGL addon failed to load, using canvas renderer:', e);
    }

    // Fit to container
    fit.fit();
    lastSize.current = { cols: term.cols, rows: term.rows };

    terminalInstance.current = term;

    // Write welcome message
    term.writeln('\x1b[1;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    term.writeln('\x1b[1;36m  OxideTerm - High Performance SSH Client\x1b[0m');
    term.writeln('\x1b[1;34m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    term.writeln('');

    return () => {
      term.dispose();
      terminalInstance.current = null;
    };
  }, []);

  // Handle incoming frames
  const handleFrame = useCallback((frame: Frame) => {
    const term = terminalInstance.current;
    if (!term) return;

    switch (frame.type) {
      case MessageType.Data:
        // Write data to terminal
        term.write(frame.data);
        break;
      
      case MessageType.Heartbeat:
        // Echo heartbeat back (respond with same seq)
        if (webSocket.current?.readyState === WebSocket.OPEN) {
          const response = encodeFrame(heartbeatFrame(frame.seq));
          webSocket.current.send(response);
          console.debug(`Heartbeat echo seq=${frame.seq}`);
        }
        break;
      
      case MessageType.Resize:
        // Server-initiated resize (unusual but handle it)
        console.log(`Server resize: ${frame.cols}x${frame.rows}`);
        break;
      
      case MessageType.Error:
        // Display error in terminal
        term.writeln(`\x1b[31mError: ${frame.message}\x1b[0m`);
        console.error('Protocol error:', frame.message);
        break;
    }
  }, []);

  // Send resize to server (debounced)
  const sendResize = useCallback((cols: number, rows: number) => {
    if (webSocket.current?.readyState === WebSocket.OPEN) {
      const frame = encodeFrame(resizeFrame(cols, rows));
      webSocket.current.send(frame);
      console.log(`Sent resize: ${cols}x${rows}`);
    }
  }, []);

  // Connect to WebSocket when URL is available
  useEffect(() => {
    if (!wsUrl || !terminalInstance.current) return;

    const term = terminalInstance.current;
    let ws: WebSocket | null = null;
    let retryCount = 0;
    const maxRetries = 5;
    const retryDelay = 300; // ms
    let cancelled = false;

    const connectWithRetry = () => {
      if (cancelled || retryCount >= maxRetries) {
        if (!cancelled) {
          term.writeln(`\x1b[31mFailed to connect after ${maxRetries} attempts.\x1b[0m`);
          updateSessionStatus(sessionId, 'error', 'Connection failed');
        }
        return;
      }

      retryCount++;
      term.writeln(`\x1b[33mConnecting to session... (attempt ${retryCount}/${maxRetries})\x1b[0m`);

      // Create WebSocket connection
      ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      webSocket.current = ws;
      decoder.current.clear();
      
      // Capture ws in a const that TypeScript knows is non-null
      const currentWs = ws;

      // Set connection timeout
      const connectionTimeout = setTimeout(() => {
        if (currentWs.readyState === WebSocket.CONNECTING) {
          currentWs.close();
          term.writeln(`\x1b[33mConnection timeout, retrying...\x1b[0m`);
          setTimeout(connectWithRetry, retryDelay);
        }
      }, 3000);

      currentWs.onopen = () => {
        clearTimeout(connectionTimeout);
        term.writeln(`\x1b[32mConnected!\x1b[0m\n`);
        updateSessionStatus(sessionId, 'connected');
        
        // Set up terminal data handler (user input)
        const dataHandler = term.onData((data) => {
          if (currentWs.readyState === WebSocket.OPEN) {
            const encoder = new TextEncoder();
            const frame = encodeFrame(dataFrame(encoder.encode(data)));
            currentWs.send(frame);
          }
        });

        // Set up binary handler (for copy/paste of binary data)
        const binaryHandler = term.onBinary((data) => {
          if (currentWs.readyState === WebSocket.OPEN) {
            const bytes = new Uint8Array(data.length);
            for (let i = 0; i < data.length; i++) {
              bytes[i] = data.charCodeAt(i);
            }
            const frame = encodeFrame(dataFrame(bytes));
            currentWs.send(frame);
          }
        });

        // Send initial resize
        if (lastSize.current) {
          sendResize(lastSize.current.cols, lastSize.current.rows);
        }

        // Start heartbeat timer
        heartbeatTimer.current = setInterval(() => {
          if (currentWs.readyState === WebSocket.OPEN) {
            const seq = heartbeatSeq.current++;
            const frame = encodeFrame(heartbeatFrame(seq));
            currentWs.send(frame);
            console.debug(`Sent heartbeat seq=${seq}`);
          }
        }, HEARTBEAT_INTERVAL_MS);

        // Clean up handlers on close
        currentWs.onclose = () => {
          dataHandler.dispose();
          binaryHandler.dispose();
        };
      };

      currentWs.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          const data = new Uint8Array(event.data);
          decoder.current.feed(data);
          
          // Process all complete frames
          let frame: Frame | null;
          try {
            while ((frame = decoder.current.decodeNext()) !== null) {
              handleFrame(frame);
            }
          } catch (e) {
            console.warn('Protocol decode error:', e);
            // Fallback: treat remaining buffer as raw data
            if (decoder.current.remaining > 0) {
              // For backward compatibility with legacy mode
              term.write(data);
              decoder.current.clear();
            }
          }
        }
      };

      currentWs.onclose = (event) => {
        clearTimeout(connectionTimeout);
        
        // Clear heartbeat timer
        if (heartbeatTimer.current) {
          clearInterval(heartbeatTimer.current);
          heartbeatTimer.current = null;
        }
        
        if (!cancelled && retryCount < maxRetries && event.code !== 1000) {
          // Not a normal close, retry
          setTimeout(connectWithRetry, retryDelay);
        } else if (event.code === 1000) {
          term.writeln('\n\x1b[33mConnection closed.\x1b[0m');
          updateSessionStatus(sessionId, 'disconnected');
        } else if (!cancelled) {
          updateSessionStatus(sessionId, 'disconnected');
        }
      };

      currentWs.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error('WebSocket error:', error);
        // Error will trigger onclose, which handles retry
      };
    };

    // Small delay to ensure server is ready
    const initialDelay = setTimeout(connectWithRetry, 100);

    return () => {
      cancelled = true;
      clearTimeout(initialDelay);
      
      if (heartbeatTimer.current) {
        clearInterval(heartbeatTimer.current);
        heartbeatTimer.current = null;
      }
      
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Component unmounting');
      }
      webSocket.current = null;
    };
  }, [wsUrl, sessionId, handleFrame, sendResize, updateSessionStatus]);

  // Handle resize with debouncing
  useEffect(() => {
    const handleResize = () => {
      if (fitAddon.current && isActive && terminalInstance.current) {
        fitAddon.current.fit();
        
        const term = terminalInstance.current;
        const newCols = term.cols;
        const newRows = term.rows;
        
        // Check if size actually changed
        if (lastSize.current?.cols !== newCols || lastSize.current?.rows !== newRows) {
          lastSize.current = { cols: newCols, rows: newRows };
          
          // Debounce resize message
          if (resizeTimer.current) {
            clearTimeout(resizeTimer.current);
          }
          resizeTimer.current = setTimeout(() => {
            sendResize(newCols, newRows);
          }, RESIZE_DEBOUNCE_MS);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    
    // Initial fit when becoming active
    if (isActive) {
      setTimeout(handleResize, 100);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimer.current) {
        clearTimeout(resizeTimer.current);
      }
    };
  }, [isActive, sendResize]);

  // Focus terminal when active
  useEffect(() => {
    if (isActive && terminalInstance.current) {
      terminalInstance.current.focus();
    }
  }, [isActive]);

  return (
    <div
      ref={terminalRef}
      className="terminal-container w-full h-full"
      style={{ 
        display: isActive ? 'block' : 'none',
        padding: '8px',
        backgroundColor: '#1e1e2e',
      }}
    />
  );
}

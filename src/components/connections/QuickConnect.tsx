/**
 * QuickConnect Component
 * 
 * Compact form for quick SSH connections without saving.
 * Appears in Command Palette or as a popover.
 */

import * as React from 'react';
import { motion } from 'framer-motion';
import { Server, User, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface QuickConnectProps {
  onConnect: (host: string, username: string, port?: number) => void;
  isConnecting?: boolean;
  className?: string;
}

export function QuickConnect({
  onConnect,
  isConnecting = false,
  className,
}: QuickConnectProps) {
  const [input, setInput] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const parsed = parseConnectionString(input);
    if (parsed) {
      onConnect(parsed.host, parsed.username, parsed.port);
    }
  };

  const parsed = parseConnectionString(input);
  const isValid = parsed !== null;

  return (
    <motion.form
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      onSubmit={handleSubmit}
      className={cn('flex flex-col gap-3', className)}
    >
      <div className="space-y-1">
        <label className="text-xs text-overlay-1">
          Quick Connect (user@host:port)
        </label>
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="root@192.168.1.1:22"
          leftIcon={<Server size={14} />}
          className="font-mono"
        />
      </div>

      {/* Parsed Preview */}
      {input && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-surface-0 text-xs">
          {isValid ? (
            <>
              <User size={12} className="text-overlay-1" />
              <span className="text-text">{parsed.username}</span>
              <span className="text-overlay-0">@</span>
              <span className="text-blue">{parsed.host}</span>
              <span className="text-overlay-0">:</span>
              <span className="text-mauve">{parsed.port}</span>
            </>
          ) : (
            <span className="text-yellow">Invalid format. Use user@host or user@host:port</span>
          )}
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={!isValid || isConnecting}
        className="w-full"
      >
        {isConnecting ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <ArrowRight size={14} />
        )}
        Connect
      </Button>
    </motion.form>
  );
}

// ============================================
// Helper Functions
// ============================================

interface ParsedConnection {
  username: string;
  host: string;
  port: number;
}

function parseConnectionString(input: string): ParsedConnection | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Pattern: user@host:port or user@host
  const match = trimmed.match(/^([^@]+)@([^:]+)(?::(\d+))?$/);
  if (!match) return null;

  const [, username, host, portStr] = match;
  const port = portStr ? parseInt(portStr, 10) : 22;

  if (!username || !host || isNaN(port) || port < 1 || port > 65535) {
    return null;
  }

  return { username, host, port };
}

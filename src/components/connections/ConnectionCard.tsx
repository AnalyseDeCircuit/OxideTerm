/**
 * ConnectionCard Component (Warp-Inspired)
 *
 * Individual connection item with status indicator,
 * quick actions, and context menu support.
 */

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Server,
  MoreVertical,
  Pencil,
  Trash2,
  Copy,
  ExternalLink,
  Lock,
  KeyRound,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/Tooltip';
import type { ConnectionInfo } from '@/lib/config';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

interface ConnectionCardProps {
  connection: ConnectionInfo;
  status?: ConnectionStatus;
  isActive?: boolean;
  onConnect: (connection: ConnectionInfo) => void;
  onEdit?: (connection: ConnectionInfo) => void;
  onDelete?: (connection: ConnectionInfo) => void;
  onDuplicate?: (connection: ConnectionInfo) => void;
  className?: string;
}

export function ConnectionCard({
  connection,
  status = 'disconnected',
  isActive = false,
  onConnect,
  onEdit,
  onDelete,
  onDuplicate,
  className,
}: ConnectionCardProps) {
  const handleConnect = (e: React.MouseEvent) => {
    e.stopPropagation();
    onConnect(connection);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(connection);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(connection);
  };

  const handleDuplicate = () => {
    onDuplicate?.(connection);
  };

  // Auth type icon as function
  const renderAuthIcon = () => {
    if (connection.authType === 'password') {
      return <Lock size={10} className="shrink-0 text-subtext-1" />;
    }
    if (connection.authType === 'key' || connection.authType === 'agent') {
      return <KeyRound size={10} className="shrink-0 text-subtext-1" />;
    }
    return <Lock size={10} className="shrink-0 text-subtext-1" />;
  };

  return (
    <TooltipProvider delayDuration={200}>
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        whileHover={{ backgroundColor: 'var(--ui-surface-hover)' }}
        onClick={handleConnect}
        className={cn(
          'group relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer',
          'transition-all duration-200',
          isActive && 'bg-ui-surface-active text-white',
          className
        )}
      >
        {/* Status Indicator - Circle (Warp style) */}
        <StatusDot status={status} />

        {/* Connection Icon with Color */}
        <div
          className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
          style={{
            backgroundColor: `${connection.color || 'var(--mauve)'}20`,
            color: connection.color || 'var(--mauve)',
          }}
        >
          <Server size={14} />
        </div>

        {/* Connection Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-text font-sans truncate">
              {connection.name}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                {renderAuthIcon()}
              </TooltipTrigger>
              <TooltipContent>
                {connection.authType === 'password' && 'Password auth'}
                {connection.authType === 'key' && 'SSH key auth'}
                {connection.authType === 'agent' && 'SSH agent'}
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="text-xs font-mono truncate text-subtext-0">
            {connection.username}@{connection.host}
            {connection.port !== 22 && `:${connection.port}`}
          </div>
        </div>

        {/* Actions (visible on hover) */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {onEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleEdit}
                  className="text-subtext-1 hover:text-text rounded-md"
                >
                  <Pencil size={12} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit</TooltipContent>
            </Tooltip>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => e.stopPropagation()}
                className="text-subtext-1 hover:text-text rounded-md"
              >
                <MoreVertical size={12} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleConnect}>
                <ExternalLink size={14} />
                Connect
              </DropdownMenuItem>
              {onDuplicate && (
                <DropdownMenuItem onClick={handleDuplicate}>
                  <Copy size={14} />
                  Duplicate
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem onClick={handleEdit}>
                  <Pencil size={14} />
                  Edit
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="text-red focus:text-red"
                  >
                    <Trash2 size={14} />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.div>
    </TooltipProvider>
  );
}

// ============================================
// Status Dot Component (Circle - Warp style)
// ============================================

interface StatusDotProps {
  status: ConnectionStatus;
}

function StatusDot({ status }: StatusDotProps) {
  const statusConfig = {
    connected: {
      color: 'bg-green',
      pulse: false,
    },
    connecting: {
      color: 'bg-yellow',
      pulse: true,
    },
    disconnected: {
      color: 'bg-subtext-1',
      pulse: false,
    },
    error: {
      color: 'bg-red',
      pulse: false,
    },
  };

  const config = statusConfig[status];

  return (
    <span className="relative shrink-0">
      <span
        className={cn(
          'block w-2 h-2 rounded-full',
          config.color,
          config.pulse && 'animate-pulse'
        )}
      />
      {status === 'connected' && (
        <span className="absolute inset-0 w-2 h-2 rounded-full bg-green/40 animate-ping" />
      )}
    </span>
  );
}

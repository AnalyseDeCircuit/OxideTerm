/**
 * EmptyState Component
 * 
 * Consistent empty state displays for various contexts.
 */

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Server,
  FolderOpen,
  Search,
  Wifi,
  FileQuestion,
  Inbox,
  Terminal,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';
import { fadeScaleVariants } from '@/lib/animations';

type EmptyStateVariant =
  | 'no-connections'
  | 'no-sessions'
  | 'no-files'
  | 'no-results'
  | 'offline'
  | 'empty-folder'
  | 'generic';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const variantConfig: Record<
  EmptyStateVariant,
  { icon: React.ReactNode; title: string; description: string }
> = {
  'no-connections': {
    icon: <Server className="w-12 h-12" />,
    title: 'No connections yet',
    description: 'Create your first SSH connection to get started',
  },
  'no-sessions': {
    icon: <Terminal className="w-12 h-12" />,
    title: 'No active sessions',
    description: 'Connect to a server to start a terminal session',
  },
  'no-files': {
    icon: <FolderOpen className="w-12 h-12" />,
    title: 'No files here',
    description: 'This folder is empty',
  },
  'no-results': {
    icon: <Search className="w-12 h-12" />,
    title: 'No results found',
    description: 'Try adjusting your search or filter criteria',
  },
  offline: {
    icon: <Wifi className="w-12 h-12" />,
    title: 'You are offline',
    description: 'Check your network connection and try again',
  },
  'empty-folder': {
    icon: <Inbox className="w-12 h-12" />,
    title: 'Empty folder',
    description: 'Drop files here or create new ones',
  },
  generic: {
    icon: <FileQuestion className="w-12 h-12" />,
    title: 'Nothing here',
    description: 'There is nothing to display',
  },
};

export function EmptyState({
  variant = 'generic',
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  const config = variantConfig[variant];

  return (
    <motion.div
      variants={fadeScaleVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={cn(
        'flex flex-col items-center justify-center py-12 px-6 text-center',
        className
      )}
    >
      {/* Icon */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="mb-4 text-overlay-1"
      >
        {icon || config.icon}
      </motion.div>

      {/* Title */}
      <motion.h3
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="text-lg font-medium text-text mb-2"
      >
        {title || config.title}
      </motion.h3>

      {/* Description */}
      <motion.p
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="text-sm text-overlay-1 max-w-xs mb-6"
      >
        {description || config.description}
      </motion.p>

      {/* Action Button */}
      {action && (
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.3 }}
        >
          <Button variant="primary" size="sm" onClick={action.onClick}>
            <Plus size={14} />
            {action.label}
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * Inline Empty State - Compact version for lists/tables
 */
interface InlineEmptyStateProps {
  message?: string;
  className?: string;
}

export function InlineEmptyState({
  message = 'No items',
  className,
}: InlineEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center py-8 text-sm text-overlay-1',
        className
      )}
    >
      <span>{message}</span>
    </div>
  );
}

/**
 * ErrorState Component
 * 
 * Consistent error displays with retry actions.
 */

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  XCircle,
  WifiOff,
  ServerCrash,
  RefreshCw,
  Bug,
  ShieldAlert,
  Home,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';
import { fadeScaleVariants } from '@/lib/animations';

type ErrorVariant =
  | 'generic'
  | 'network'
  | 'server'
  | 'permission'
  | 'not-found'
  | 'crash';

interface ErrorStateProps {
  variant?: ErrorVariant;
  title?: string;
  message?: string;
  error?: Error | string | null;
  icon?: React.ReactNode;
  onRetry?: () => void;
  onGoHome?: () => void;
  showDetails?: boolean;
  className?: string;
}

const variantConfig: Record<
  ErrorVariant,
  { icon: React.ReactNode; title: string; message: string }
> = {
  generic: {
    icon: <AlertTriangle className="w-12 h-12" />,
    title: 'Something went wrong',
    message: 'An unexpected error occurred. Please try again.',
  },
  network: {
    icon: <WifiOff className="w-12 h-12" />,
    title: 'Connection failed',
    message: 'Unable to connect. Check your network and try again.',
  },
  server: {
    icon: <ServerCrash className="w-12 h-12" />,
    title: 'Server error',
    message: 'The server encountered an error. Please try again later.',
  },
  permission: {
    icon: <ShieldAlert className="w-12 h-12" />,
    title: 'Access denied',
    message: "You don't have permission to perform this action.",
  },
  'not-found': {
    icon: <XCircle className="w-12 h-12" />,
    title: 'Not found',
    message: 'The requested resource could not be found.',
  },
  crash: {
    icon: <Bug className="w-12 h-12" />,
    title: 'Application error',
    message: 'The application encountered a critical error.',
  },
};

export function ErrorState({
  variant = 'generic',
  title,
  message,
  error,
  icon,
  onRetry,
  onGoHome,
  showDetails = false,
  className,
}: ErrorStateProps) {
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const config = variantConfig[variant];
  const errorMessage = error instanceof Error ? error.message : error;

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
      {/* Icon with shake animation */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="mb-4 text-red"
      >
        <motion.div
          animate={{ x: [0, -3, 3, -3, 3, 0] }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          {icon || config.icon}
        </motion.div>
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

      {/* Message */}
      <motion.p
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="text-sm text-overlay-1 max-w-xs mb-6"
      >
        {message || config.message}
      </motion.p>

      {/* Error Details (collapsible) */}
      {showDetails && errorMessage && (
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.3 }}
          className="mb-6 w-full max-w-md"
        >
          <button
            onClick={() => setDetailsOpen(!detailsOpen)}
            className="text-xs text-overlay-0 hover:text-overlay-1 transition-colors"
          >
            {detailsOpen ? 'Hide details' : 'Show details'}
          </button>
          {detailsOpen && (
            <motion.pre
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-2 p-3 rounded-md bg-surface-0 text-xs text-overlay-1 font-mono text-left overflow-x-auto"
            >
              {errorMessage}
            </motion.pre>
          )}
        </motion.div>
      )}

      {/* Actions */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="flex items-center gap-2"
      >
        {onRetry && (
          <Button variant="primary" size="sm" onClick={onRetry}>
            <RefreshCw size={14} />
            Try again
          </Button>
        )}
        {onGoHome && (
          <Button variant="ghost" size="sm" onClick={onGoHome}>
            <Home size={14} />
            Go home
          </Button>
        )}
      </motion.div>
    </motion.div>
  );
}

/**
 * Inline Error - Compact error for forms/inputs
 */
interface InlineErrorProps {
  message: string;
  className?: string;
}

export function InlineError({ message, className }: InlineErrorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className={cn(
        'flex items-center gap-1.5 text-xs text-red',
        className
      )}
    >
      <AlertTriangle size={12} />
      <span>{message}</span>
    </motion.div>
  );
}

/**
 * Error Banner - Top-level error notification
 */
interface ErrorBannerProps {
  title?: string;
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
  className?: string;
}

export function ErrorBanner({
  title,
  message,
  onDismiss,
  onRetry,
  className,
}: ErrorBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg',
        'bg-red/10 border border-red/20',
        className
      )}
    >
      <AlertTriangle size={18} className="shrink-0 text-red" />
      <div className="flex-1 min-w-0">
        {title && (
          <p className="text-sm font-medium text-text">{title}</p>
        )}
        <p className="text-xs text-overlay-1 truncate">{message}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onRetry && (
          <Button variant="ghost" size="icon-sm" onClick={onRetry}>
            <RefreshCw size={14} />
          </Button>
        )}
        {onDismiss && (
          <Button variant="ghost" size="icon-sm" onClick={onDismiss}>
            <XCircle size={14} />
          </Button>
        )}
      </div>
    </motion.div>
  );
}

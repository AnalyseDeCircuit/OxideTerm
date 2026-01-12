/**
 * LoadingState Component
 * 
 * Various loading state displays for different contexts.
 */

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { Spinner, DotsSpinner, PulseSpinner, TerminalSpinner } from './Spinner';
import { Skeleton } from './Skeleton';

type LoadingVariant = 'spinner' | 'dots' | 'pulse' | 'terminal' | 'skeleton';

interface LoadingStateProps {
  variant?: LoadingVariant;
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingState({
  variant = 'spinner',
  message,
  size = 'md',
  className,
}: LoadingStateProps) {
  const spinnerSizes = {
    sm: 'sm' as const,
    md: 'md' as const,
    lg: 'lg' as const,
  };

  const renderSpinner = () => {
    switch (variant) {
      case 'dots':
        return <DotsSpinner />;
      case 'pulse':
        return <PulseSpinner />;
      case 'terminal':
        return <TerminalSpinner />;
      default:
        return <Spinner size={spinnerSizes[size]} />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        'flex flex-col items-center justify-center py-8',
        className
      )}
    >
      {renderSpinner()}
      {message && (
        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-3 text-sm text-overlay-1"
        >
          {message}
        </motion.p>
      )}
    </motion.div>
  );
}

/**
 * Loading Overlay - Full screen or container overlay
 */
interface LoadingOverlayProps {
  message?: string;
  className?: string;
}

export function LoadingOverlay({ message, className }: LoadingOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        'absolute inset-0 z-50 flex items-center justify-center',
        'bg-base/80 backdrop-blur-sm',
        className
      )}
    >
      <div className="flex flex-col items-center">
        <Spinner size="lg" />
        {message && (
          <p className="mt-4 text-sm text-text">{message}</p>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Connection Loading - SSH connection progress
 */
interface ConnectionLoadingProps {
  host: string;
  stage?: 'connecting' | 'authenticating' | 'establishing' | 'ready';
  className?: string;
}

const stageMessages = {
  connecting: 'Connecting...',
  authenticating: 'Authenticating...',
  establishing: 'Establishing session...',
  ready: 'Ready!',
};

export function ConnectionLoading({
  host,
  stage = 'connecting',
  className,
}: ConnectionLoadingProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        'flex flex-col items-center justify-center py-12',
        className
      )}
    >
      <PulseSpinner className="mb-6" />
      <p className="text-sm font-medium text-text mb-1">{host}</p>
      <div className="flex items-center gap-2">
        <motion.span
          key={stage}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-overlay-1"
        >
          {stageMessages[stage]}
        </motion.span>
        {stage !== 'ready' && <DotsSpinner />}
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mt-6">
        {(['connecting', 'authenticating', 'establishing', 'ready'] as const).map(
          (s, i) => (
            <React.Fragment key={s}>
              <motion.div
                className={cn(
                  'w-2 h-2 rounded-full',
                  getStageIndex(stage) >= i ? 'bg-green' : 'bg-surface-1'
                )}
                animate={
                  getStageIndex(stage) === i
                    ? { scale: [1, 1.2, 1] }
                    : {}
                }
                transition={{ duration: 0.5, repeat: Infinity }}
              />
              {i < 3 && (
                <div
                  className={cn(
                    'w-4 h-0.5',
                    getStageIndex(stage) > i ? 'bg-green' : 'bg-surface-1'
                  )}
                />
              )}
            </React.Fragment>
          )
        )}
      </div>
    </motion.div>
  );
}

function getStageIndex(stage: ConnectionLoadingProps['stage']): number {
  const stages = ['connecting', 'authenticating', 'establishing', 'ready'];
  return stages.indexOf(stage || 'connecting');
}

/**
 * List Loading Skeleton - For loading lists
 */
interface ListLoadingProps {
  count?: number;
  className?: string;
}

export function ListLoading({ count = 5, className }: ListLoadingProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex items-center gap-3 p-2"
        >
          <Skeleton className="w-8 h-8 rounded-md" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2 w-1/2" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/**
 * Card Loading Skeleton - For loading cards
 */
interface CardLoadingProps {
  count?: number;
  className?: string;
}

export function CardLoading({ count = 3, className }: CardLoadingProps) {
  return (
    <div className={cn('grid gap-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="p-4 rounded-lg border border-surface-0 bg-surface-0/30"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

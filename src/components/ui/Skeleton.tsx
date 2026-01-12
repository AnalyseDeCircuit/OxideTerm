/**
 * Skeleton Component
 * 
 * Loading placeholder with shimmer animation.
 * 
 * @example
 * <Skeleton className="h-4 w-[200px]" />
 * <Skeleton className="h-12 w-12 rounded-full" />
 * <SkeletonText lines={3} />
 */

import * as React from 'react';
import { cn } from '@/lib/cn';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => {
  return (
    <div
      className={cn(
        'animate-skeleton rounded-md bg-surface-0',
        className
      )}
      {...props}
    />
  );
};

// Multi-line text skeleton
interface SkeletonTextProps {
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}

const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 3,
  className,
  lastLineWidth = '60%',
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4"
          style={{
            width: i === lines - 1 ? lastLineWidth : '100%',
          }}
        />
      ))}
    </div>
  );
};

// Card skeleton
const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('space-y-3 rounded-lg border border-surface-1 p-4', className)}>
    <div className="flex items-center gap-3">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
    <SkeletonText lines={2} />
  </div>
);

// List item skeleton
const SkeletonListItem: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('flex items-center gap-3 py-2', className)}>
    <Skeleton className="h-8 w-8 rounded" />
    <div className="flex-1 space-y-1">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  </div>
);

export { Skeleton, SkeletonText, SkeletonCard, SkeletonListItem };

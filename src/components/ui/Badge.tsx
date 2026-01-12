/**
 * Badge Component
 * 
 * Small status indicator / label.
 * 
 * @example
 * <Badge>Default</Badge>
 * <Badge variant="success">Active</Badge>
 * <Badge variant="warning">Pending</Badge>
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const badgeVariants = cva(
  [
    'inline-flex items-center rounded-full px-2 py-0.5',
    'text-xs font-medium',
    'transition-colors duration-fast',
  ],
  {
    variants: {
      variant: {
        default: 'bg-surface-0 text-text border border-surface-1',
        primary: 'bg-primary-muted text-mauve border border-mauve/20',
        secondary: 'bg-surface-0 text-subtext-1 border border-surface-1',
        success: 'bg-success-muted text-green border border-green/20',
        warning: 'bg-warning-muted text-yellow border border-yellow/20',
        error: 'bg-error-muted text-red border border-red/20',
        info: 'bg-info-muted text-blue border border-blue/20',
        outline: 'border border-surface-1 text-text bg-transparent',
      },
      size: {
        sm: 'text-[10px] px-1.5 py-0',
        md: 'text-xs px-2 py-0.5',
        lg: 'text-sm px-2.5 py-0.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge: React.FC<BadgeProps> = ({ className, variant, size, ...props }) => {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
};

// Dot indicator for status
interface StatusDotProps {
  status: 'online' | 'offline' | 'busy' | 'away' | 'connecting';
  className?: string;
  pulse?: boolean;
}

const statusColors = {
  online: 'bg-green',
  offline: 'bg-overlay-0',
  busy: 'bg-red',
  away: 'bg-yellow',
  connecting: 'bg-blue',
};

const StatusDot: React.FC<StatusDotProps> = ({ status, className, pulse = false }) => (
  <span
    className={cn(
      'inline-block h-2 w-2 rounded-full',
      statusColors[status],
      pulse && status === 'connecting' && 'animate-pulse',
      className
    )}
  />
);

export { Badge, badgeVariants, StatusDot };

/**
 * Separator Component
 * 
 * Visual divider for separating content.
 * 
 * @example
 * <Separator />
 * <Separator orientation="vertical" />
 * <Separator label="OR" />
 */

import * as React from 'react';
import { cn } from '@/lib/cn';

interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
  decorative?: boolean;
  label?: string;
}

const Separator: React.FC<SeparatorProps> = ({
  className,
  orientation = 'horizontal',
  decorative = true,
  label,
  ...props
}) => {
  const isHorizontal = orientation === 'horizontal';

  if (label) {
    return (
      <div
        role={decorative ? 'none' : 'separator'}
        aria-orientation={orientation}
        className={cn(
          'flex items-center gap-3',
          isHorizontal ? 'w-full' : 'flex-col h-full',
          className
        )}
        {...props}
      >
        <div
          className={cn(
            'bg-surface-1 shrink-0',
            isHorizontal ? 'h-px flex-1' : 'w-px flex-1'
          )}
        />
        <span className="text-xs text-overlay-1 uppercase tracking-wider">
          {label}
        </span>
        <div
          className={cn(
            'bg-surface-1 shrink-0',
            isHorizontal ? 'h-px flex-1' : 'w-px flex-1'
          )}
        />
      </div>
    );
  }

  return (
    <div
      role={decorative ? 'none' : 'separator'}
      aria-orientation={orientation}
      className={cn(
        'shrink-0 bg-surface-1',
        isHorizontal ? 'h-px w-full' : 'h-full w-px',
        className
      )}
      {...props}
    />
  );
};

export { Separator };

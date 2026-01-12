/**
 * ScrollArea Component
 * 
 * Custom scrollable area with styled scrollbars.
 * Wrapper around native scrolling with consistent styling.
 * 
 * @example
 * <ScrollArea className="h-[300px]">
 *   <div>Long content here...</div>
 * </ScrollArea>
 */

import * as React from 'react';
import { cn } from '@/lib/cn';

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Orientation of scrolling */
  orientation?: 'vertical' | 'horizontal' | 'both';
}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, orientation = 'vertical', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'relative',
          orientation === 'vertical' && 'overflow-y-auto overflow-x-hidden',
          orientation === 'horizontal' && 'overflow-x-auto overflow-y-hidden',
          orientation === 'both' && 'overflow-auto',
          // Custom scrollbar styling
          'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-1',
          'hover:scrollbar-thumb-surface-2',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ScrollArea.displayName = 'ScrollArea';

export { ScrollArea };

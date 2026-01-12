/**
 * Tooltip Component
 * 
 * Informational popup on hover, built on Radix UI Tooltip.
 * 
 * @example
 * <TooltipProvider>
 *   <Tooltip>
 *     <TooltipTrigger asChild>
 *       <Button>Hover me</Button>
 *     </TooltipTrigger>
 *     <TooltipContent>
 *       <p>This is a tooltip</p>
 *     </TooltipContent>
 *   </Tooltip>
 * </TooltipProvider>
 */

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/cn';

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-tooltip overflow-hidden rounded-md border border-surface-1 bg-surface-0 px-3 py-1.5',
        'text-xs text-text shadow-md',
        // Animation
        'animate-in fade-in-0 zoom-in-95',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        'data-[side=bottom]:slide-in-from-top-2',
        'data-[side=left]:slide-in-from-right-2',
        'data-[side=right]:slide-in-from-left-2',
        'data-[side=top]:slide-in-from-bottom-2',
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

// Convenience wrapper for simple tooltips
interface SimpleTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  delayDuration?: number;
}

const SimpleTooltip: React.FC<SimpleTooltipProps> = ({
  content,
  children,
  side = 'top',
  delayDuration = 200,
}) => (
  <Tooltip delayDuration={delayDuration}>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent side={side}>{content}</TooltipContent>
  </Tooltip>
);

export {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  SimpleTooltip,
};

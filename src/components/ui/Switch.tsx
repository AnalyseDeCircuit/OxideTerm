/**
 * Switch Component
 * 
 * Toggle switch built on Radix UI Switch.
 * 
 * @example
 * <Switch />
 * <Switch checked={enabled} onCheckedChange={setEnabled} />
 * <SwitchWithLabel>Enable notifications</SwitchWithLabel>
 */

import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/lib/cn';

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full',
      'border-2 border-transparent',
      'bg-surface-1',
      'ring-offset-base',
      'transition-colors duration-fast',
      'hover:bg-surface-2',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mauve focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:bg-mauve',
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block h-4 w-4 rounded-full',
        'bg-text shadow-sm',
        'ring-0',
        'transition-transform duration-fast',
        'data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
        'data-[state=checked]:bg-crust'
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;

// Convenience component with label
interface SwitchWithLabelProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  label?: React.ReactNode;
  description?: string;
}

const SwitchWithLabel = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SwitchWithLabelProps
>(({ className, label, description, id, children, ...props }, ref) => {
  const generatedId = React.useId();
  const switchId = id || generatedId;

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="grid gap-1">
        <label
          htmlFor={switchId}
          className="text-sm font-medium text-text cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
        >
          {label || children}
        </label>
        {description && (
          <p className="text-xs text-subtext-0">{description}</p>
        )}
      </div>
      <Switch ref={ref} id={switchId} className={className} {...props} />
    </div>
  );
});
SwitchWithLabel.displayName = 'SwitchWithLabel';

export { Switch, SwitchWithLabel };

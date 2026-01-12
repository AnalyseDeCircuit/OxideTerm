/**
 * Checkbox Component
 * 
 * Checkbox input built on Radix UI Checkbox.
 * 
 * @example
 * <Checkbox id="terms" />
 * <label htmlFor="terms">Accept terms</label>
 * 
 * // With label wrapper
 * <CheckboxWithLabel>Accept terms and conditions</CheckboxWithLabel>
 */

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/cn';

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer h-4 w-4 shrink-0 rounded-sm border border-surface-1 bg-mantle',
      'ring-offset-base',
      'hover:border-surface-2',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mauve focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:bg-mauve data-[state=checked]:border-mauve data-[state=checked]:text-crust',
      'data-[state=indeterminate]:bg-mauve data-[state=indeterminate]:border-mauve data-[state=indeterminate]:text-crust',
      'transition-colors duration-fast',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn('flex items-center justify-center text-current')}
    >
      {props.checked === 'indeterminate' ? (
        <Minus className="h-3 w-3" />
      ) : (
        <Check className="h-3 w-3" />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

// Convenience component with label
interface CheckboxWithLabelProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  label?: React.ReactNode;
  description?: string;
}

const CheckboxWithLabel = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxWithLabelProps
>(({ className, label, description, id, children, ...props }, ref) => {
  const generatedId = React.useId();
  const checkboxId = id || generatedId;

  return (
    <div className="flex items-start gap-2">
      <Checkbox ref={ref} id={checkboxId} className={className} {...props} />
      <div className="grid gap-1 leading-none">
        <label
          htmlFor={checkboxId}
          className="text-sm font-medium text-text cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
        >
          {label || children}
        </label>
        {description && (
          <p className="text-xs text-subtext-0">{description}</p>
        )}
      </div>
    </div>
  );
});
CheckboxWithLabel.displayName = 'CheckboxWithLabel';

export { Checkbox, CheckboxWithLabel };

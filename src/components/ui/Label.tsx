/**
 * Label Component
 * 
 * Accessible form label.
 * 
 * @example
 * <Label htmlFor="email">Email</Label>
 * <Input id="email" />
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const labelVariants = cva(
  'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'text-text',
        muted: 'text-subtext-1',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement>,
    VariantProps<typeof labelVariants> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, variant, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(labelVariants({ variant }), className)}
      {...props}
    />
  )
);
Label.displayName = 'Label';

export { Label, labelVariants };

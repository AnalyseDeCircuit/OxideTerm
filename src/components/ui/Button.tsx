/**
 * Button Component
 *
 * Primary interactive element with Warp-inspired styling.
 * Features:
 * - Subtle gradients and borders
 * - Soft shadows
 * - Smooth transitions
 * - Rounded corners (6-8px)
 *
 * @example
 * <Button variant="primary" size="md">Click me</Button>
 * <Button variant="ghost" size="icon"><Icon /></Button>
 * <Button variant="danger" isLoading>Deleting...</Button>
 */

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { Loader2 } from 'lucide-react';

export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2',
    'font-medium whitespace-nowrap',
    'transition-all duration-200 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-base',
    'disabled:pointer-events-none disabled:opacity-50',
    'select-none',
    'rounded-md', // Warp-style: 8px border radius
  ],
  {
    variants: {
      variant: {
        /**
         * Primary action - Warp purple gradient
         */
        primary: [
          'bg-gradient-to-b from-purple-500/18 to-purple-500/8',
          'border border-purple-400/20',
          'text-purple-400',
          'shadow-sm',
          'hover:from-purple-500/28 hover:to-purple-500/12',
          'hover:border-purple-400/40',
          'hover:shadow-md hover:-translate-y-0.5',
          'active:scale-98 active:translate-y-0',
        ],
        /**
         * Secondary action - subtle surface
         */
        secondary: [
          'bg-ui-surface-bg text-text',
          'border border-glass-border',
          'shadow-sm',
          'hover:bg-ui-surface-hover hover:border-surface-1',
          'active:bg-surface-0',
          'rounded-md',
        ],
        /**
         * Ghost - minimal styling
         */
        ghost: [
          'text-subtext-0 bg-transparent border-none',
          'hover:bg-ui-surface-hover hover:text-text',
          'active:bg-surface-0',
          'rounded-md',
        ],
        /**
         * Outline - bordered variant
         */
        outline: [
          'border border-glass-border text-text bg-transparent',
          'hover:bg-ui-surface-hover',
          'active:bg-surface-0',
          'rounded-md',
        ],
        /**
         * Danger - destructive actions
         */
        danger: [
          'bg-red/10 text-red',
          'border border-red/20',
          'hover:bg-red/20 hover:shadow-red/20',
          'active:bg-red/30',
          'rounded-md',
        ],
        /**
         * Success - positive actions
         */
        success: [
          'bg-green/10 text-green',
          'border border-green/20',
          'hover:bg-green/20 hover:shadow-green/20',
          'active:bg-green/30',
          'rounded-md',
        ],
        /**
         * Link - text-only, underlined on hover
         */
        link: [
          'text-blue underline-offset-4',
          'hover:underline',
          'active:text-purple-500',
        ],
      },
      size: {
        /**
         * Extra small - badges
         */
        xs: 'h-6 px-2 text-xs rounded-sm',
        /**
         * Small - secondary actions
         */
        sm: 'h-7 px-2.5 text-xs rounded-md',
        /**
         * Medium - default
         */
        md: 'h-9 px-3 text-sm rounded-md',
        /**
         * Large - prominent CTAs
         */
        lg: 'h-11 px-4 text-base rounded-lg',
        /**
         * Extra large - hero sections
         */
        xl: 'h-14 px-6 text-lg rounded-xl',
        /**
         * Icon only - square button
         */
        icon: 'h-9 w-9 rounded-md',
        /**
         * Small icon - compact
         */
        'icon-sm': 'h-7 w-7 rounded-md',
        /**
         * Large icon - prominent
         */
        'icon-lg': 'h-11 w-11 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as child element (Radix Slot) */
  asChild?: boolean;
  /** Show loading spinner and disable */
  isLoading?: boolean;
  /** Left icon element */
  leftIcon?: React.ReactNode;
  /** Right icon element */
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={isLoading || disabled}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {children}
          </>
        ) : (
          <>
            {leftIcon}
            {children}
            {rightIcon}
          </>
        )}
      </Comp>
    );
  }
);

Button.displayName = 'Button';

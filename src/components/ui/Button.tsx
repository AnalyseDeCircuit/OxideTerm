/**
 * Button Component
 * 
 * Primary interactive element with multiple variants and sizes.
 * Uses CVA (Class Variance Authority) for type-safe styling.
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
  // Base styles - always applied
  [
    'inline-flex items-center justify-center gap-2',
    'font-medium whitespace-nowrap',
    'transition-colors duration-fast ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mauve focus-visible:ring-offset-2 focus-visible:ring-offset-base',
    'disabled:pointer-events-none disabled:opacity-50',
    'select-none',
  ],
  {
    variants: {
      variant: {
        /** Primary action - most prominent */
        primary: [
          'bg-mauve text-crust',
          'hover:bg-[#d4b8f9]',
          'active:bg-[#c299f5]',
        ],
        /** Secondary action - less prominent */
        secondary: [
          'bg-surface-0 text-text',
          'hover:bg-surface-1',
          'active:bg-surface-2',
          'border border-surface-1',
        ],
        /** Ghost - minimal styling, for toolbars */
        ghost: [
          'text-subtext-1',
          'hover:bg-surface-0 hover:text-text',
          'active:bg-surface-1',
        ],
        /** Outline - bordered variant */
        outline: [
          'border border-surface-1 text-text bg-transparent',
          'hover:bg-surface-0 hover:border-surface-2',
          'active:bg-surface-1',
        ],
        /** Danger - destructive actions */
        danger: [
          'bg-error-muted text-red',
          'hover:bg-[rgba(243,139,168,0.25)]',
          'active:bg-[rgba(243,139,168,0.35)]',
        ],
        /** Success - positive actions */
        success: [
          'bg-success-muted text-green',
          'hover:bg-[rgba(166,227,161,0.25)]',
          'active:bg-[rgba(166,227,161,0.35)]',
        ],
        /** Link - text-only, underlined on hover */
        link: [
          'text-blue underline-offset-4',
          'hover:underline',
          'active:text-sapphire',
        ],
      },
      size: {
        /** Extra small - badges, compact toolbars */
        xs: 'h-6 px-2 text-xs rounded-sm',
        /** Small - secondary actions */
        sm: 'h-7 px-2.5 text-xs rounded-sm',
        /** Medium - default, primary actions */
        md: 'h-8 px-3 text-sm rounded-md',
        /** Large - prominent CTAs */
        lg: 'h-10 px-4 text-base rounded-md',
        /** Extra large - hero sections */
        xl: 'h-12 px-6 text-lg rounded-lg',
        /** Icon only - square button */
        icon: 'h-8 w-8 rounded-md',
        /** Small icon - compact icon button */
        'icon-sm': 'h-7 w-7 rounded-sm',
        /** Large icon - prominent icon button */
        'icon-lg': 'h-10 w-10 rounded-lg',
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

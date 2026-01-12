/**
 * Input Component
 * 
 * Text input field with consistent styling and variants.
 * Supports icons, error states, and sizing.
 * 
 * @example
 * <Input placeholder="Search..." />
 * <Input leftIcon={<SearchIcon />} />
 * <Input error="This field is required" />
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

export const inputVariants = cva(
  [
    'flex w-full rounded-md border bg-transparent',
    'text-text placeholder:text-overlay-1',
    'transition-colors duration-fast',
    'focus:outline-none focus:ring-2 focus:ring-mauve focus:ring-offset-1 focus:ring-offset-base',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'file:border-0 file:bg-transparent file:text-sm file:font-medium',
  ],
  {
    variants: {
      variant: {
        default: [
          'border-surface-1 bg-mantle',
          'hover:border-surface-2',
          'focus:border-mauve',
        ],
        filled: [
          'border-transparent bg-surface-0',
          'hover:bg-surface-1',
          'focus:bg-surface-0 focus:border-mauve',
        ],
        ghost: [
          'border-transparent bg-transparent',
          'hover:bg-surface-0',
          'focus:bg-surface-0 focus:border-mauve',
        ],
      },
      size: {
        sm: 'h-7 px-2 text-xs',
        md: 'h-8 px-3 text-sm',
        lg: 'h-10 px-4 text-base',
      },
      hasError: {
        true: 'border-red focus:ring-red',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      hasError: false,
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  /** Icon to display on the left */
  leftIcon?: React.ReactNode;
  /** Icon to display on the right */
  rightIcon?: React.ReactNode;
  /** Error message to display */
  error?: string;
  /** Container className */
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      containerClassName,
      variant,
      size,
      leftIcon,
      rightIcon,
      error,
      type = 'text',
      ...props
    },
    ref
  ) => {
    const hasError = !!error;

    return (
      <div className={cn('relative flex flex-col gap-1', containerClassName)}>
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-2.5 flex items-center text-overlay-1">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            ref={ref}
            className={cn(
              inputVariants({ variant, size, hasError }),
              leftIcon && 'pl-8',
              rightIcon && 'pr-8',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-2.5 flex items-center text-overlay-1">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <span className="text-xs text-red">{error}</span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

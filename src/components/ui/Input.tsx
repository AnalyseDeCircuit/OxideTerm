/**
 * Input Component
 *
 * Text input field with Warp-inspired styling.
 * Features:
 * - Soft rounded corners
 * - Subtle borders
 * - Glassmorphism background
 * - Smooth focus transitions
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
     'flex w-full border',
     'text-text placeholder:text-subtext-1',
     'transition-all duration-200',
     'focus:outline-none',
     'disabled:cursor-not-allowed disabled:opacity-50',
     'file:border-0 file:bg-transparent file:text-sm file:font-medium',
     'rounded-md', // Warp-style: 8px border radius
   ],
   {
     variants: {
       variant: {
         /**
          * Default - subtle border
          */
         default: [
           'border-glass-border bg-ui-surface-bg',
           'hover:border-surface-1',
           'focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:ring-offset-2 focus:ring-offset-base',
         ],
         /**
          * Filled - darker background
          */
         filled: [
           'border-transparent bg-surface-0',
           'hover:bg-surface-1',
           'focus:bg-surface-0 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20',
         ],
         /**
          * Ghost - transparent
          */
         ghost: [
           'border-transparent bg-transparent',
           'hover:bg-ui-surface-hover',
           'focus:bg-ui-surface-hover focus:border-purple-500/50',
         ],
       },
       size: {
         sm: 'h-7 px-2 text-xs',
         md: 'h-9 px-3 text-sm',
         lg: 'h-11 px-4 text-base',
       },
       hasError: {
         true: 'border-red focus:border-red focus:ring-red focus:ring-red/20',
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
            <div className="absolute left-3 flex items-center text-subtext-0">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            ref={ref}
            className={cn(
              inputVariants({ variant, size, hasError }),
              leftIcon && 'pl-9',
              rightIcon && 'pr-9',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 flex items-center text-subtext-0">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <span className="text-xs text-red font-medium">{error}</span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

/**
 * Toast Component
 * 
 * Notification toasts built on Radix UI Toast.
 * 
 * Usage:
 * 1. Add <Toaster /> to your app root
 * 2. Use the useToast() hook to show toasts
 * 
 * @example
 * const { toast } = useToast();
 * toast({ title: "Success!", description: "Your changes were saved." });
 */

import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { cva, type VariantProps } from 'class-variance-authority';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/cn';

const ToastProvider = ToastPrimitive.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      'fixed bottom-0 right-0 z-toast flex max-h-screen w-full flex-col-reverse gap-2 p-4',
      'sm:bottom-4 sm:right-4 sm:top-auto sm:flex-col sm:max-w-[380px]',
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitive.Viewport.displayName;

const toastVariants = cva(
  [
    'group pointer-events-auto relative flex w-full items-start gap-3',
    'overflow-hidden rounded-lg border p-4 shadow-lg',
    'transition-all',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[swipe=end]:animate-out',
    'data-[state=closed]:fade-out-80 data-[state=open]:fade-in-0',
    'data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-bottom-full',
    'data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]',
    'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none',
  ],
  {
    variants: {
      variant: {
        default: 'border-surface-1 bg-mantle text-text',
        success: 'border-green/20 bg-success-muted text-text',
        error: 'border-red/20 bg-error-muted text-text',
        warning: 'border-yellow/20 bg-warning-muted text-text',
        info: 'border-blue/20 bg-info-muted text-text',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => (
  <ToastPrimitive.Root
    ref={ref}
    className={cn(toastVariants({ variant }), className)}
    {...props}
  />
));
Toast.displayName = ToastPrimitive.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Action
    ref={ref}
    className={cn(
      'inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-surface-1 bg-transparent px-3',
      'text-sm font-medium text-text',
      'ring-offset-base transition-colors',
      'hover:bg-surface-0',
      'focus:outline-none focus:ring-2 focus:ring-mauve focus:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      className
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitive.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Close
    ref={ref}
    className={cn(
      'absolute right-2 top-2 rounded-md p-1',
      'text-overlay-1 opacity-0',
      'transition-opacity',
      'hover:text-text',
      'focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-mauve',
      'group-hover:opacity-100',
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitive.Close>
));
ToastClose.displayName = ToastPrimitive.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title
    ref={ref}
    className={cn('text-sm font-semibold text-text', className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitive.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description
    ref={ref}
    className={cn('text-sm text-subtext-1', className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitive.Description.displayName;

// Icons for variants
const toastIcons = {
  default: null,
  success: <CheckCircle className="h-5 w-5 text-green" />,
  error: <AlertCircle className="h-5 w-5 text-red" />,
  warning: <AlertTriangle className="h-5 w-5 text-yellow" />,
  info: <Info className="h-5 w-5 text-blue" />,
};

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;
type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  toastIcons,
};

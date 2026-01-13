import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-oxide-accent disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 shadow-none border border-transparent",
        secondary:
          "bg-theme-bg-panel text-oxide-text border border-theme-border hover:bg-zinc-800",
        outline:
          "border border-theme-border bg-transparent hover:bg-zinc-800 text-oxide-text",
        ghost: "hover:bg-zinc-800 hover:text-zinc-100 text-oxide-text",
        destructive:
          "bg-red-900 text-red-100 hover:bg-red-800 border border-red-900",
        link: "text-zinc-100 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-8",
        icon: "h-9 w-9",
      },
      radius: {
        none: "rounded-none",
        sm: "rounded-sm", // 2px
      }
    },
    defaultVariants: {
      variant: "secondary",
      size: "default",
      radius: "sm",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, radius, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, radius, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

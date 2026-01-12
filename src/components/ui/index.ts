/**
 * UI Components - Barrel Export
 * 
 * Central export point for all primitive UI components.
 * Import components from here: import { Button, Input } from '@/components/ui'
 */

// Buttons
export { Button, buttonVariants } from './Button';

// Form inputs
export { Input, inputVariants } from './Input';
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from './Select';
export { Checkbox, CheckboxWithLabel } from './Checkbox';
export { Switch, SwitchWithLabel } from './Switch';
export { Slider, LabeledSlider } from './Slider';
export { Label, labelVariants } from './Label';

// Feedback
export {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  SimpleTooltip,
} from './Tooltip';
export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
} from './Toast';
export { useToast, toast, Toaster } from './useToast';

// Overlays
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './Dialog';
export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from './Sheet';
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from './DropdownMenu';

// Navigation
export { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';

// Data display
export { Badge, badgeVariants, StatusDot } from './Badge';
export { Skeleton, SkeletonText, SkeletonCard, SkeletonListItem } from './Skeleton';

// Layout
export { Separator } from './Separator';
export { ScrollArea } from './ScrollArea';

// Loading States (Phase 4)
export { Spinner, DotsSpinner, PulseSpinner, TerminalSpinner } from './Spinner';
export {
  LoadingState,
  LoadingOverlay,
  ConnectionLoading,
  ListLoading,
  CardLoading,
} from './LoadingState';

// Empty States (Phase 4)
export { EmptyState, InlineEmptyState } from './EmptyState';

// Error States (Phase 4)
export { ErrorState, InlineError, ErrorBanner } from './ErrorState';

// Page Transitions (Phase 4)
export {
  PageTransition,
  ViewStack,
  StaggerContainer,
  StaggerItem,
  RevealOnScroll,
  Presence,
  pageTransitionVariants,
  fadePageVariants,
  slidePageVariants,
  staggerItemVariants,
} from './PageTransition';

// Micro-interactions (Phase 4)
export {
  PressEffect,
  HoverScale,
  HoverGlow,
  CopyButton,
  LikeButton,
  SuccessCheck,
  useRipple,
  PulseDot,
  Counter,
  Shimmer,
} from './MicroInteractions';

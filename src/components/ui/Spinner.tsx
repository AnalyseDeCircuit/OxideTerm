/**
 * Spinner Component
 * 
 * Animated loading spinner with multiple size variants.
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <motion.div
      className={cn('relative', sizeMap[size], className)}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="w-full h-full"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          className="opacity-20"
        />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          className="text-mauve"
        />
      </svg>
    </motion.div>
  );
}

/**
 * Dots Spinner - Three bouncing dots
 */
export function DotsSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-mauve"
          animate={{
            y: [0, -4, 0],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

/**
 * Pulse Spinner - Expanding rings
 */
export function PulseSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('relative w-8 h-8', className)}>
      {[0, 1].map((i) => (
        <motion.span
          key={i}
          className="absolute inset-0 rounded-full border-2 border-mauve"
          animate={{
            scale: [1, 2],
            opacity: [0.5, 0],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: i * 0.75,
            ease: 'easeOut',
          }}
        />
      ))}
      <span className="absolute inset-[25%] rounded-full bg-mauve" />
    </div>
  );
}

/**
 * Terminal Spinner - Typing cursor effect
 */
export function TerminalSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-1 font-mono text-sm', className)}>
      <span className="text-green">$</span>
      <motion.span
        className="w-2 h-4 bg-text"
        animate={{ opacity: [1, 0] }}
        transition={{
          duration: 0.8,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    </div>
  );
}

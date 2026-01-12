/**
 * Micro-interaction Components
 * 
 * Small, delightful interactions for enhanced UX.
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Copy, Heart } from 'lucide-react';
import { cn } from '@/lib/cn';

// ============================================
// Press Effect - Button press feedback
// ============================================

interface PressEffectProps {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function PressEffect({ children, className, disabled }: PressEffectProps) {
  return (
    <motion.div
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.1 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// Hover Scale - Subtle hover enlarge
// ============================================

interface HoverScaleProps {
  children: React.ReactNode;
  scale?: number;
  className?: string;
}

export function HoverScale({ children, scale = 1.02, className }: HoverScaleProps) {
  return (
    <motion.div
      whileHover={{ scale }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// Hover Glow - Glowing border on hover
// ============================================

interface HoverGlowProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

export function HoverGlow({
  children,
  color = 'var(--mauve)',
  className,
}: HoverGlowProps) {
  return (
    <motion.div
      whileHover={{
        boxShadow: `0 0 20px ${color}30`,
      }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// Copy Button with Feedback
// ============================================

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className }: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.button
      onClick={handleCopy}
      whileTap={{ scale: 0.9 }}
      className={cn(
        'p-1.5 rounded-md text-overlay-1 hover:text-text',
        'hover:bg-surface-0 transition-colors',
        className
      )}
    >
      <AnimatePresence mode="wait">
        {copied ? (
          <motion.div
            key="check"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
          >
            <Check size={14} className="text-green" />
          </motion.div>
        ) : (
          <motion.div
            key="copy"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
          >
            <Copy size={14} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ============================================
// Like/Heart Button with Animation
// ============================================

interface LikeButtonProps {
  liked?: boolean;
  onToggle?: (liked: boolean) => void;
  className?: string;
}

export function LikeButton({ liked = false, onToggle, className }: LikeButtonProps) {
  const [isLiked, setIsLiked] = React.useState(liked);

  const handleClick = () => {
    setIsLiked(!isLiked);
    onToggle?.(!isLiked);
  };

  return (
    <motion.button
      onClick={handleClick}
      whileTap={{ scale: 0.8 }}
      className={cn('relative p-2', className)}
    >
      <motion.div
        animate={isLiked ? { scale: [1, 1.3, 1] } : {}}
        transition={{ duration: 0.3 }}
      >
        <Heart
          size={18}
          className={cn(
            'transition-colors',
            isLiked ? 'fill-red text-red' : 'text-overlay-1'
          )}
        />
      </motion.div>
      {/* Burst particles */}
      <AnimatePresence>
        {isLiked && (
          <>
            {[...Array(6)].map((_, i) => (
              <motion.span
                key={i}
                initial={{ scale: 0, opacity: 1 }}
                animate={{
                  scale: 1,
                  opacity: 0,
                  x: Math.cos((i * 60 * Math.PI) / 180) * 20,
                  y: Math.sin((i * 60 * Math.PI) / 180) * 20,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute top-1/2 left-1/2 w-1 h-1 rounded-full bg-red"
              />
            ))}
          </>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ============================================
// Success Checkmark Animation
// ============================================

interface SuccessCheckProps {
  show: boolean;
  size?: number;
  className?: string;
}

export function SuccessCheck({ show, size = 48, className }: SuccessCheckProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={cn('relative', className)}
          style={{ width: size, height: size }}
        >
          {/* Circle */}
          <motion.svg
            viewBox="0 0 50 50"
            className="w-full h-full"
          >
            <motion.circle
              cx="25"
              cy="25"
              r="22"
              fill="none"
              stroke="var(--green)"
              strokeWidth="3"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
            <motion.path
              d="M14 27 L22 35 L38 18"
              fill="none"
              stroke="var(--green)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.3, delay: 0.3, ease: 'easeOut' }}
            />
          </motion.svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================
// Ripple Effect
// ============================================

interface RippleProps {
  className?: string;
}

export function useRipple() {
  const [ripples, setRipples] = React.useState<
    { x: number; y: number; id: number }[]
  >([]);

  const addRipple = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();

    setRipples((prev) => [...prev, { x, y, id }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 600);
  };

  const Ripples = ({ className }: RippleProps) => (
    <>
      {ripples.map((ripple) => (
        <motion.span
          key={ripple.id}
          initial={{ scale: 0, opacity: 0.5 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={cn(
            'absolute w-10 h-10 rounded-full bg-white/20 pointer-events-none',
            className
          )}
          style={{
            left: ripple.x - 20,
            top: ripple.y - 20,
          }}
        />
      ))}
    </>
  );

  return { addRipple, Ripples };
}

// ============================================
// Pulse Notification Dot
// ============================================

interface PulseDotProps {
  show?: boolean;
  className?: string;
}

export function PulseDot({ show = true, className }: PulseDotProps) {
  if (!show) return null;

  return (
    <span className={cn('relative flex h-2 w-2', className)}>
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-red" />
    </span>
  );
}

// ============================================
// Number Counter Animation
// ============================================

interface CounterProps {
  value: number;
  duration?: number;
  className?: string;
}

export function Counter({ value, duration = 1, className }: CounterProps) {
  const [displayValue, setDisplayValue] = React.useState(0);

  React.useEffect(() => {
    let startTime: number;
    let animationFrame: number;
    const startValue = displayValue;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      
      setDisplayValue(Math.floor(startValue + (value - startValue) * progress));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  return <span className={className}>{displayValue}</span>;
}

// ============================================
// Shimmer Effect (for skeleton loading)
// ============================================

interface ShimmerProps {
  className?: string;
}

export function Shimmer({ className }: ShimmerProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-surface-0 rounded',
        className
      )}
    >
      <motion.div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent"
        animate={{ x: ['0%', '200%'] }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    </div>
  );
}

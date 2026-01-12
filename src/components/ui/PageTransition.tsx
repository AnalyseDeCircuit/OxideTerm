/**
 * Page Transition Components
 * 
 * Smooth page and view transitions using Framer Motion.
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/cn';

// ============================================
// Page Transition Variants
// ============================================

export const pageTransitionVariants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  enter: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 1, 1] as const,
    },
  },
};

export const fadePageVariants = {
  initial: { opacity: 0 },
  enter: {
    opacity: 1,
    transition: { duration: 0.3 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

export const slidePageVariants = {
  initial: (direction: number) => ({
    x: direction > 0 ? 100 : -100,
    opacity: 0,
  }),
  enter: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 100 : -100,
    opacity: 0,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 1, 1] as const,
    },
  }),
};

// ============================================
// PageTransition Component
// ============================================

interface PageTransitionProps {
  children: React.ReactNode;
  pageKey: string;
  variant?: 'fade' | 'slide' | 'default';
  direction?: number;
  className?: string;
}

export function PageTransition({
  children,
  pageKey,
  variant = 'default',
  direction = 1,
  className,
}: PageTransitionProps) {
  const variants =
    variant === 'fade'
      ? fadePageVariants
      : variant === 'slide'
      ? slidePageVariants
      : pageTransitionVariants;

  return (
    <AnimatePresence mode="wait" custom={direction}>
      <motion.div
        key={pageKey}
        custom={direction}
        variants={variants}
        initial="initial"
        animate="enter"
        exit="exit"
        className={cn('w-full h-full', className)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================
// View Stack - For nested view navigation
// ============================================

interface ViewStackProps {
  children: React.ReactNode;
  viewKey: string;
  className?: string;
}

export function ViewStack({ children, viewKey, className }: ViewStackProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={viewKey}
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] as const }}
        className={cn('w-full h-full', className)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================
// Stagger Container - For staggered children
// ============================================

interface StaggerContainerProps {
  children: React.ReactNode;
  staggerDelay?: number;
  className?: string;
}

export function StaggerContainer({
  children,
  staggerDelay = 0.05,
  className,
}: StaggerContainerProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="hidden"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export const staggerItemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
}

export function StaggerItem({ children, className }: StaggerItemProps) {
  return (
    <motion.div variants={staggerItemVariants} className={className}>
      {children}
    </motion.div>
  );
}

// ============================================
// Reveal on Scroll
// ============================================

interface RevealOnScrollProps {
  children: React.ReactNode;
  className?: string;
}

export function RevealOnScroll({ children, className }: RevealOnScrollProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// Presence Animation Wrapper
// ============================================

interface PresenceProps {
  show: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Presence({ show, children, className }: PresenceProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

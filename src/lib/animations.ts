/**
 * OxideTerm Animation System
 * 
 * Framer Motion animation variants for consistent UI animations.
 * Use these variants throughout the app for unified motion design.
 */

import type { Variants, Transition } from 'framer-motion';

// ============================================
// Transition Presets
// ============================================

export const transitions = {
  /** Fast, snappy interactions (buttons, toggles) */
  fast: {
    duration: 0.1,
    ease: "easeOut", // Snappy
  } satisfies Transition,
  
  /** Default transition for most animations */
  normal: {
    duration: 0.15, // Faster
    ease: "easeOut",
  } satisfies Transition,
  
  /** Slower, more deliberate animations (panels, modals) */
  slow: {
    duration: 0.2, // Faster
    ease: "easeOut",
  } satisfies Transition,
  
  /** Smooth exponential ease out - slightly faster now */
  smooth: {
    duration: 0.25,
    ease: [0.16, 1, 0.3, 1],
  } satisfies Transition,
  
  /** Spring animation disabled - using fast linear/ease-out */
  spring: {
    duration: 0.15,
    ease: "easeOut",
  } satisfies Transition,
  
  /** Bouncy spring disabled - using fast linear/ease-out */
  bounce: {
    duration: 0.15,
    ease: "easeOut",
  } satisfies Transition,
};

// ============================================
// Fade Variants
// ============================================

export const fadeVariants: Variants = {
  hidden: { 
    opacity: 0 
  },
  visible: { 
    opacity: 1,
    transition: transitions.normal,
  },
  exit: { 
    opacity: 0,
    transition: transitions.fast,
  },
};

export const fadeScaleVariants: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.95 
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: transitions.smooth,
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    transition: transitions.normal,
  },
};

// ============================================
// Slide Variants
// ============================================

export const slideUpVariants: Variants = {
  hidden: { 
    opacity: 0, 
    y: 10 
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: transitions.smooth,
  },
  exit: { 
    opacity: 0, 
    y: 10,
    transition: transitions.normal,
  },
};

export const slideDownVariants: Variants = {
  hidden: { 
    opacity: 0, 
    y: -10 
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: transitions.smooth,
  },
  exit: { 
    opacity: 0, 
    y: -10,
    transition: transitions.normal,
  },
};

export const slideLeftVariants: Variants = {
  hidden: { 
    opacity: 0, 
    x: 20 
  },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: transitions.smooth,
  },
  exit: { 
    opacity: 0, 
    x: 20,
    transition: transitions.normal,
  },
};

export const slideRightVariants: Variants = {
  hidden: { 
    opacity: 0, 
    x: -20 
  },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: transitions.smooth,
  },
  exit: { 
    opacity: 0, 
    x: -20,
    transition: transitions.normal,
  },
};

// ============================================
// Panel/Drawer Variants
// ============================================

export const sidebarVariants: Variants = {
  collapsed: { 
    width: 48,
    transition: transitions.smooth,
  },
  expanded: { 
    width: 220,
    transition: transitions.smooth,
  },
};

export const bottomPanelVariants: Variants = {
  hidden: { 
    height: 0,
    opacity: 0,
    transition: transitions.smooth,
  },
  visible: (height: number = 200) => ({
    height,
    opacity: 1,
    transition: transitions.smooth,
  }),
};

export const drawerVariants: Variants = {
  hidden: { 
    x: '100%',
    opacity: 0,
  },
  visible: { 
    x: 0,
    opacity: 1,
    transition: transitions.smooth,
  },
  exit: { 
    x: '100%',
    opacity: 0,
    transition: transitions.normal,
  },
};

// ============================================
// Modal/Dialog Variants
// ============================================

export const modalBackdropVariants: Variants = {
  hidden: { 
    opacity: 0 
  },
  visible: { 
    opacity: 1,
    transition: { duration: 0.2 },
  },
  exit: { 
    opacity: 0,
    transition: { duration: 0.15 },
  },
};

export const modalContentVariants: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.95,
    y: -10,
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
    },
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    y: 10,
    transition: transitions.normal,
  },
};

// ============================================
// Command Palette Variants
// ============================================

export const commandPaletteVariants: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.98,
    y: -20,
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: { 
    opacity: 0, 
    scale: 0.98,
    y: -10,
    transition: { duration: 0.15 },
  },
};

// ============================================
// List/Stagger Variants
// ============================================

export const listContainerVariants: Variants = {
  hidden: { 
    opacity: 0 
  },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const listItemVariants: Variants = {
  hidden: { 
    opacity: 0, 
    y: 10 
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: transitions.normal,
  },
};

// ============================================
// Tab Variants
// ============================================

export const tabIndicatorVariants: Variants = {
  inactive: {
    opacity: 0,
    scale: 0.9,
  },
  active: {
    opacity: 1,
    scale: 1,
    transition: transitions.spring,
  },
};

export const tabContentVariants: Variants = {
  hidden: { 
    opacity: 0, 
    x: 10 
  },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: transitions.normal,
  },
  exit: { 
    opacity: 0, 
    x: -10,
    transition: transitions.fast,
  },
};

// ============================================
// Toast/Notification Variants
// ============================================

export const toastVariants: Variants = {
  hidden: { 
    opacity: 0, 
    y: 50, 
    scale: 0.9 
  },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: transitions.bounce,
  },
  exit: { 
    opacity: 0, 
    y: 20, 
    scale: 0.9,
    transition: transitions.normal,
  },
};

// ============================================
// Tooltip Variants
// ============================================

export const tooltipVariants: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.95 
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.15 },
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    transition: { duration: 0.1 },
  },
};

// ============================================
// Dropdown/Menu Variants
// ============================================

export const dropdownVariants: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.95,
    y: -5,
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    y: 0,
    transition: {
      duration: 0.15,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    y: -5,
    transition: { duration: 0.1 },
  },
};

// ============================================
// Skeleton/Loading Variants
// ============================================

export const skeletonVariants: Variants = {
  loading: {
    opacity: [0.5, 1, 0.5],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

export const pulseVariants: Variants = {
  pulse: {
    scale: [1, 1.05, 1],
    opacity: [1, 0.8, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// ============================================
// Micro-interaction Variants
// ============================================

export const pressVariants: Variants = {
  rest: { scale: 1 },
  pressed: { scale: 0.97 },
  hover: { scale: 1.02 },
};

export const hoverGlowVariants: Variants = {
  rest: { 
    boxShadow: '0 0 0 rgba(203, 166, 247, 0)' 
  },
  hover: { 
    boxShadow: '0 0 20px rgba(203, 166, 247, 0.15)',
    transition: { duration: 0.2 },
  },
};

// ============================================
// Connection Status Variants
// ============================================

export const connectionDotVariants: Variants = {
  disconnected: { 
    scale: 1, 
    backgroundColor: '#6c7086' 
  },
  connecting: {
    scale: [1, 1.2, 1],
    backgroundColor: '#f9e2af',
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
  connected: { 
    scale: 1, 
    backgroundColor: '#a6e3a1' 
  },
  error: { 
    scale: 1, 
    backgroundColor: '#f38ba8' 
  },
};

// ============================================
// Utility: Create stagger variants
// ============================================

export function createStaggerVariants(
  staggerDelay: number = 0.05,
  initialDelay: number = 0
): Variants {
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: initialDelay,
      },
    },
  };
}

// ============================================
// Utility: Wrap animation props
// ============================================

export const animationProps = {
  fadeIn: {
    initial: 'hidden',
    animate: 'visible',
    exit: 'exit',
    variants: fadeVariants,
  },
  fadeScale: {
    initial: 'hidden',
    animate: 'visible',
    exit: 'exit',
    variants: fadeScaleVariants,
  },
  slideUp: {
    initial: 'hidden',
    animate: 'visible',
    exit: 'exit',
    variants: slideUpVariants,
  },
  modal: {
    initial: 'hidden',
    animate: 'visible',
    exit: 'exit',
    variants: modalContentVariants,
  },
} as const;

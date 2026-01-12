/**
 * cn() - Utility function for merging Tailwind CSS classes
 * 
 * Combines clsx (conditional classes) with tailwind-merge (deduplication)
 * to handle class conflicts intelligently.
 * 
 * @example
 * cn('px-2 py-1', condition && 'bg-blue', 'px-4')
 * // Result: 'py-1 px-4 bg-blue' (px-4 overrides px-2)
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

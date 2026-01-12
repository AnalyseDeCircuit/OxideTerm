/**
 * Theme Store
 *
 * Manages application theming with Warp-inspired palette.
 * Supports multiple themes with different accent colors.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeId =
  | 'warp-purple'
  | 'warp-blue'
  | 'dracula'
  | 'nord'
  | 'tokyo-night'
  | 'catppuccin-mocha';

export interface Theme {
  id: ThemeId;
  name: string;
  accentColor: string;
  accentColorHover: string;
  accentColorMuted: string;
}

export const themes: Theme[] = [
  {
    id: 'warp-purple',
    name: 'Warp Purple',
    accentColor: '#8b5cf6',
    accentColorHover: '#a78bfa',
    accentColorMuted: 'rgba(139, 92, 246, 0.1)',
  },
  {
    id: 'warp-blue',
    name: 'Warp Blue',
    accentColor: '#3b82f6',
    accentColorHover: '#60a5fa',
    accentColorMuted: 'rgba(59, 130, 246, 0.1)',
  },
  {
    id: 'dracula',
    name: 'Dracula',
    accentColor: '#bd93f9',
    accentColorHover: '#ff79c6',
    accentColorMuted: 'rgba(189, 147, 249, 0.1)',
  },
  {
    id: 'nord',
    name: 'Nord',
    accentColor: '#88c0d0',
    accentColorHover: '#81a1c1',
    accentColorMuted: 'rgba(136, 192, 208, 0.1)',
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    accentColor: '#7aa2f7',
    accentColorHover: '#9d7ff8',
    accentColorMuted: 'rgba(122, 162, 247, 0.1)',
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    accentColor: '#cba6f7',
    accentColorHover: '#d4b8f9',
    accentColorMuted: 'rgba(203, 166, 247, 0.1)',
  },
];

interface ThemeStoreState {
  // Current theme
  themeId: ThemeId;
  theme: Theme;

  // Actions
  setTheme: (themeId: ThemeId) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeStoreState>()(
  persist(
    (set) => ({
      themeId: 'warp-purple',
      theme: themes[0],

      setTheme: (themeId: ThemeId) => {
        const theme = themes.find((t) => t.id === themeId) || themes[0];
        set({ themeId, theme });

        // Apply theme colors as CSS variables
        const root = document.documentElement;
        root.style.setProperty('--color-primary-solid', theme.accentColor);
        root.style.setProperty('--color-primary-hover', theme.accentColorHover);
        root.style.setProperty('--color-primary-muted', theme.accentColorMuted);
        root.style.setProperty('--ring-color-solid', theme.accentColor);
      },

      toggleTheme: () => {
        set((state) => {
          const currentIndex = themes.findIndex((t) => t.id === state.themeId);
          const nextIndex = (currentIndex + 1) % themes.length;
          const nextTheme = themes[nextIndex];

          const root = document.documentElement;
          root.style.setProperty('--color-primary-solid', nextTheme.accentColor);
          root.style.setProperty('--color-primary-hover', nextTheme.accentColorHover);
          root.style.setProperty('--color-primary-muted', nextTheme.accentColorMuted);
          root.style.setProperty('--ring-color-solid', nextTheme.accentColor);

          return {
            themeId: nextTheme.id,
            theme: nextTheme,
          };
        });
      },
    }),
    {
      name: 'oxideterm-theme',
      version: 1,
    }
  )
);

// Selector hooks for convenience
export const useTheme = () => useThemeStore((state) => state.theme);
export const useThemeId = () => useThemeStore((state) => state.themeId);

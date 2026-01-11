/**
 * Terminal Configuration Store
 * 
 * Manages terminal appearance and behavior settings:
 * - Theme selection
 * - Font family and size
 * - Scrollback buffer
 * - Cursor style
 * - Bell notification
 * 
 * Persists to localStorage for cross-session consistency.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { defaultTheme, getThemeById, type TerminalTheme } from '../lib/themes';
import type { ITerminalOptions } from '@xterm/xterm';

export interface TerminalConfig {
  // Appearance
  themeId: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  
  // Cursor
  cursorBlink: boolean;
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorWidth: number;
  
  // Buffer
  scrollback: number;
  fastScrollModifier: 'alt' | 'ctrl' | 'shift' | undefined;
  fastScrollSensitivity: number;
  
  // Behavior
  rightClickSelectsWord: boolean;
  macOptionIsMeta: boolean;
  macOptionClickForcesSelection: boolean;
  altClickMovesCursor: boolean;
  
  // Bell
  bellStyle: 'none' | 'sound' | 'visual' | 'both';
  
  // Links
  linkHandler: boolean; // Enable WebLinksAddon
  
  // Unicode
  unicodeVersion: '6' | '11';
}

interface TerminalConfigState extends TerminalConfig {
  // Computed
  getTheme: () => TerminalTheme;
  getXtermOptions: () => Partial<ITerminalOptions>;
  
  // Actions
  setTheme: (themeId: string) => void;
  setFontFamily: (fontFamily: string) => void;
  setFontSize: (fontSize: number) => void;
  setLineHeight: (lineHeight: number) => void;
  setScrollback: (scrollback: number) => void;
  setCursorBlink: (blink: boolean) => void;
  setCursorStyle: (style: 'block' | 'underline' | 'bar') => void;
  setBellStyle: (style: 'none' | 'sound' | 'visual' | 'both') => void;
  setLinkHandler: (enabled: boolean) => void;
  setMacOptionIsMeta: (enabled: boolean) => void;
  reset: () => void;
  updateConfig: (partial: Partial<TerminalConfig>) => void;
}

const defaultConfig: TerminalConfig = {
  themeId: defaultTheme.id,
  fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
  fontSize: 14,
  lineHeight: 1.2,
  letterSpacing: 0,
  cursorBlink: true,
  cursorStyle: 'block',
  cursorWidth: 1,
  scrollback: 10000,
  fastScrollModifier: 'alt',
  fastScrollSensitivity: 5,
  rightClickSelectsWord: true,
  macOptionIsMeta: false,
  macOptionClickForcesSelection: false,
  altClickMovesCursor: true,
  bellStyle: 'visual',
  linkHandler: true,
  unicodeVersion: '11',
};

export const useTerminalConfig = create<TerminalConfigState>()(
  persist(
    (set, get) => ({
      ...defaultConfig,
      
      getTheme: () => getThemeById(get().themeId),
      
      getXtermOptions: () => {
        const config = get();
        const theme = getThemeById(config.themeId);
        
        return {
          theme: {
            background: theme.background,
            foreground: theme.foreground,
            cursor: theme.cursor,
            cursorAccent: theme.cursorAccent,
            selectionBackground: theme.selectionBackground,
            selectionForeground: theme.selectionForeground,
            selectionInactiveBackground: theme.selectionInactiveBackground,
            black: theme.black,
            red: theme.red,
            green: theme.green,
            yellow: theme.yellow,
            blue: theme.blue,
            magenta: theme.magenta,
            cyan: theme.cyan,
            white: theme.white,
            brightBlack: theme.brightBlack,
            brightRed: theme.brightRed,
            brightGreen: theme.brightGreen,
            brightYellow: theme.brightYellow,
            brightBlue: theme.brightBlue,
            brightMagenta: theme.brightMagenta,
            brightCyan: theme.brightCyan,
            brightWhite: theme.brightWhite,
          },
          fontFamily: config.fontFamily,
          fontSize: config.fontSize,
          lineHeight: config.lineHeight,
          letterSpacing: config.letterSpacing,
          cursorBlink: config.cursorBlink,
          cursorStyle: config.cursorStyle,
          cursorWidth: config.cursorWidth,
          scrollback: config.scrollback,
          fastScrollModifier: config.fastScrollModifier,
          fastScrollSensitivity: config.fastScrollSensitivity,
          rightClickSelectsWord: config.rightClickSelectsWord,
          macOptionIsMeta: config.macOptionIsMeta,
          macOptionClickForcesSelection: config.macOptionClickForcesSelection,
          altClickMovesCursor: config.altClickMovesCursor,
          allowProposedApi: true,
        };
      },
      
      setTheme: (themeId) => set({ themeId }),
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setFontSize: (fontSize) => set({ fontSize: Math.max(8, Math.min(32, fontSize)) }),
      setLineHeight: (lineHeight) => set({ lineHeight: Math.max(1, Math.min(2, lineHeight)) }),
      setScrollback: (scrollback) => set({ scrollback: Math.max(100, Math.min(1000000, scrollback)) }),
      setCursorBlink: (cursorBlink) => set({ cursorBlink }),
      setCursorStyle: (cursorStyle) => set({ cursorStyle }),
      setBellStyle: (bellStyle) => set({ bellStyle }),
      setLinkHandler: (linkHandler) => set({ linkHandler }),
      setMacOptionIsMeta: (macOptionIsMeta) => set({ macOptionIsMeta }),
      
      reset: () => set(defaultConfig),
      
      updateConfig: (partial) => set(partial),
    }),
    {
      name: 'oxideterm-terminal-config',
      version: 1,
    }
  )
);

// Selector hooks for performance
export const useTheme = () => useTerminalConfig(state => state.getTheme());
export const useFontSize = () => useTerminalConfig(state => state.fontSize);
export const useFontFamily = () => useTerminalConfig(state => state.fontFamily);
export const useScrollback = () => useTerminalConfig(state => state.scrollback);

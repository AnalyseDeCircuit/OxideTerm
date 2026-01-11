/**
 * Terminal Theme Presets
 * 
 * Collection of popular terminal color schemes.
 * Each theme includes 16 ANSI colors + background/foreground/cursor.
 */

import type { ITheme } from '@xterm/xterm';

export interface TerminalTheme extends ITheme {
  name: string;
  id: string;
}

/**
 * Default dark theme (OxideTerm)
 */
export const defaultTheme: TerminalTheme = {
  id: 'oxideterm',
  name: 'OxideTerm',
  background: '#1a1a2e',
  foreground: '#eaeaea',
  cursor: '#f8f8f2',
  cursorAccent: '#1a1a2e',
  selectionBackground: 'rgba(248, 248, 242, 0.3)',
  selectionForeground: undefined,
  selectionInactiveBackground: 'rgba(248, 248, 242, 0.15)',
  // ANSI Colors
  black: '#21222c',
  red: '#ff5555',
  green: '#50fa7b',
  yellow: '#f1fa8c',
  blue: '#bd93f9',
  magenta: '#ff79c6',
  cyan: '#8be9fd',
  white: '#f8f8f2',
  brightBlack: '#6272a4',
  brightRed: '#ff6e6e',
  brightGreen: '#69ff94',
  brightYellow: '#ffffa5',
  brightBlue: '#d6acff',
  brightMagenta: '#ff92df',
  brightCyan: '#a4ffff',
  brightWhite: '#ffffff',
};

/**
 * Dracula theme
 * https://draculatheme.com/
 */
export const draculaTheme: TerminalTheme = {
  id: 'dracula',
  name: 'Dracula',
  background: '#282a36',
  foreground: '#f8f8f2',
  cursor: '#f8f8f2',
  cursorAccent: '#282a36',
  selectionBackground: 'rgba(68, 71, 90, 0.8)',
  selectionForeground: undefined,
  black: '#21222c',
  red: '#ff5555',
  green: '#50fa7b',
  yellow: '#f1fa8c',
  blue: '#bd93f9',
  magenta: '#ff79c6',
  cyan: '#8be9fd',
  white: '#f8f8f2',
  brightBlack: '#6272a4',
  brightRed: '#ff6e6e',
  brightGreen: '#69ff94',
  brightYellow: '#ffffa5',
  brightBlue: '#d6acff',
  brightMagenta: '#ff92df',
  brightCyan: '#a4ffff',
  brightWhite: '#ffffff',
};

/**
 * Nord theme
 * https://www.nordtheme.com/
 */
export const nordTheme: TerminalTheme = {
  id: 'nord',
  name: 'Nord',
  background: '#2e3440',
  foreground: '#d8dee9',
  cursor: '#d8dee9',
  cursorAccent: '#2e3440',
  selectionBackground: 'rgba(136, 192, 208, 0.3)',
  selectionForeground: undefined,
  black: '#3b4252',
  red: '#bf616a',
  green: '#a3be8c',
  yellow: '#ebcb8b',
  blue: '#81a1c1',
  magenta: '#b48ead',
  cyan: '#88c0d0',
  white: '#e5e9f0',
  brightBlack: '#4c566a',
  brightRed: '#bf616a',
  brightGreen: '#a3be8c',
  brightYellow: '#ebcb8b',
  brightBlue: '#81a1c1',
  brightMagenta: '#b48ead',
  brightCyan: '#8fbcbb',
  brightWhite: '#eceff4',
};

/**
 * Solarized Dark theme
 * https://ethanschoonover.com/solarized/
 */
export const solarizedDarkTheme: TerminalTheme = {
  id: 'solarized-dark',
  name: 'Solarized Dark',
  background: '#002b36',
  foreground: '#839496',
  cursor: '#93a1a1',
  cursorAccent: '#002b36',
  selectionBackground: 'rgba(147, 161, 161, 0.3)',
  selectionForeground: undefined,
  black: '#073642',
  red: '#dc322f',
  green: '#859900',
  yellow: '#b58900',
  blue: '#268bd2',
  magenta: '#d33682',
  cyan: '#2aa198',
  white: '#eee8d5',
  brightBlack: '#002b36',
  brightRed: '#cb4b16',
  brightGreen: '#586e75',
  brightYellow: '#657b83',
  brightBlue: '#839496',
  brightMagenta: '#6c71c4',
  brightCyan: '#93a1a1',
  brightWhite: '#fdf6e3',
};

/**
 * Solarized Light theme
 */
export const solarizedLightTheme: TerminalTheme = {
  id: 'solarized-light',
  name: 'Solarized Light',
  background: '#fdf6e3',
  foreground: '#657b83',
  cursor: '#586e75',
  cursorAccent: '#fdf6e3',
  selectionBackground: 'rgba(88, 110, 117, 0.2)',
  selectionForeground: undefined,
  black: '#073642',
  red: '#dc322f',
  green: '#859900',
  yellow: '#b58900',
  blue: '#268bd2',
  magenta: '#d33682',
  cyan: '#2aa198',
  white: '#eee8d5',
  brightBlack: '#002b36',
  brightRed: '#cb4b16',
  brightGreen: '#586e75',
  brightYellow: '#657b83',
  brightBlue: '#839496',
  brightMagenta: '#6c71c4',
  brightCyan: '#93a1a1',
  brightWhite: '#fdf6e3',
};

/**
 * One Dark theme (Atom)
 * https://github.com/atom/atom/tree/master/packages/one-dark-syntax
 */
export const oneDarkTheme: TerminalTheme = {
  id: 'one-dark',
  name: 'One Dark',
  background: '#282c34',
  foreground: '#abb2bf',
  cursor: '#528bff',
  cursorAccent: '#282c34',
  selectionBackground: 'rgba(82, 139, 255, 0.3)',
  selectionForeground: undefined,
  black: '#5c6370',
  red: '#e06c75',
  green: '#98c379',
  yellow: '#e5c07b',
  blue: '#61afef',
  magenta: '#c678dd',
  cyan: '#56b6c2',
  white: '#abb2bf',
  brightBlack: '#4b5263',
  brightRed: '#be5046',
  brightGreen: '#98c379',
  brightYellow: '#d19a66',
  brightBlue: '#61afef',
  brightMagenta: '#c678dd',
  brightCyan: '#56b6c2',
  brightWhite: '#ffffff',
};

/**
 * Monokai theme
 */
export const monokaiTheme: TerminalTheme = {
  id: 'monokai',
  name: 'Monokai',
  background: '#272822',
  foreground: '#f8f8f2',
  cursor: '#f8f8f2',
  cursorAccent: '#272822',
  selectionBackground: 'rgba(73, 72, 62, 0.8)',
  selectionForeground: undefined,
  black: '#272822',
  red: '#f92672',
  green: '#a6e22e',
  yellow: '#f4bf75',
  blue: '#66d9ef',
  magenta: '#ae81ff',
  cyan: '#a1efe4',
  white: '#f8f8f2',
  brightBlack: '#75715e',
  brightRed: '#f92672',
  brightGreen: '#a6e22e',
  brightYellow: '#f4bf75',
  brightBlue: '#66d9ef',
  brightMagenta: '#ae81ff',
  brightCyan: '#a1efe4',
  brightWhite: '#f9f8f5',
};

/**
 * GitHub Dark theme
 */
export const githubDarkTheme: TerminalTheme = {
  id: 'github-dark',
  name: 'GitHub Dark',
  background: '#0d1117',
  foreground: '#c9d1d9',
  cursor: '#58a6ff',
  cursorAccent: '#0d1117',
  selectionBackground: 'rgba(56, 139, 253, 0.4)',
  selectionForeground: undefined,
  black: '#484f58',
  red: '#ff7b72',
  green: '#3fb950',
  yellow: '#d29922',
  blue: '#58a6ff',
  magenta: '#bc8cff',
  cyan: '#39c5cf',
  white: '#b1bac4',
  brightBlack: '#6e7681',
  brightRed: '#ffa198',
  brightGreen: '#56d364',
  brightYellow: '#e3b341',
  brightBlue: '#79c0ff',
  brightMagenta: '#d2a8ff',
  brightCyan: '#56d4dd',
  brightWhite: '#f0f6fc',
};

/**
 * Tokyo Night theme
 */
export const tokyoNightTheme: TerminalTheme = {
  id: 'tokyo-night',
  name: 'Tokyo Night',
  background: '#1a1b26',
  foreground: '#a9b1d6',
  cursor: '#c0caf5',
  cursorAccent: '#1a1b26',
  selectionBackground: 'rgba(40, 44, 66, 0.8)',
  selectionForeground: undefined,
  black: '#414868',
  red: '#f7768e',
  green: '#9ece6a',
  yellow: '#e0af68',
  blue: '#7aa2f7',
  magenta: '#bb9af7',
  cyan: '#7dcfff',
  white: '#c0caf5',
  brightBlack: '#414868',
  brightRed: '#f7768e',
  brightGreen: '#9ece6a',
  brightYellow: '#e0af68',
  brightBlue: '#7aa2f7',
  brightMagenta: '#bb9af7',
  brightCyan: '#7dcfff',
  brightWhite: '#c0caf5',
};

/**
 * All available themes
 */
export const themes: TerminalTheme[] = [
  defaultTheme,
  draculaTheme,
  nordTheme,
  oneDarkTheme,
  monokaiTheme,
  githubDarkTheme,
  tokyoNightTheme,
  solarizedDarkTheme,
  solarizedLightTheme,
];

/**
 * Get theme by ID
 */
export function getThemeById(id: string): TerminalTheme {
  return themes.find(t => t.id === id) ?? defaultTheme;
}

/**
 * Convert TerminalTheme to xterm ITheme (strips extra properties)
 */
export function toXtermTheme(theme: TerminalTheme): ITheme {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, name, ...xtermTheme } = theme;
  return xtermTheme;
}

/**
 * Font family presets
 */
export const fontFamilies = [
  { id: 'jetbrains-mono', name: 'JetBrains Mono', value: 'JetBrains Mono, monospace' },
  { id: 'fira-code', name: 'Fira Code', value: 'Fira Code, monospace' },
  { id: 'sf-mono', name: 'SF Mono', value: 'SF Mono, Menlo, monospace' },
  { id: 'source-code-pro', name: 'Source Code Pro', value: 'Source Code Pro, monospace' },
  { id: 'cascadia-code', name: 'Cascadia Code', value: 'Cascadia Code, monospace' },
  { id: 'monaco', name: 'Monaco', value: 'Monaco, monospace' },
  { id: 'consolas', name: 'Consolas', value: 'Consolas, monospace' },
  { id: 'ubuntu-mono', name: 'Ubuntu Mono', value: 'Ubuntu Mono, monospace' },
  { id: 'system', name: 'System Default', value: 'Menlo, Monaco, Consolas, monospace' },
];

/**
 * Font size presets
 */
export const fontSizes = [10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24];

/**
 * Scrollback buffer presets
 */
export const scrollbackOptions = [
  { value: 1000, label: '1,000 lines' },
  { value: 5000, label: '5,000 lines' },
  { value: 10000, label: '10,000 lines' },
  { value: 25000, label: '25,000 lines' },
  { value: 50000, label: '50,000 lines' },
  { value: 100000, label: '100,000 lines' },
];

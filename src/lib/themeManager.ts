import { themes } from './themes';

/**
 * Apply a global theme to the entire application
 * This function:
 * 1. Sets the data-theme attribute on the document root
 * 2. Dispatches an event for xterm.js terminals to update
 */
export const applyGlobalTheme = (themeName: string) => {
  // Validate theme exists
  if (!themes[themeName]) {
    console.warn(`Theme "${themeName}" not found, falling back to default`);
    themeName = 'default';
  }

  // Set data-theme attribute for CSS variables
  document.documentElement.setAttribute('data-theme', themeName);

  // Dispatch event for terminal components to update their xterm instances
  window.dispatchEvent(
    new CustomEvent('global-theme-changed', {
      detail: {
        themeName,
        xtermTheme: themes[themeName],
      },
    })
  );
};

/**
 * Get the current theme name from the document attribute
 */
export const getCurrentTheme = (): string => {
  return document.documentElement.getAttribute('data-theme') || 'default';
};

/**
 * Initialize theme on app startup
 */
export const initializeTheme = () => {
  const saved = localStorage.getItem('oxide-settings');
  if (saved) {
    try {
      const settings = JSON.parse(saved);
      if (settings.theme) {
        applyGlobalTheme(settings.theme);
        return;
      }
    } catch (e) {
      console.error('Failed to parse saved settings:', e);
    }
  }
  // Default theme
  applyGlobalTheme('default');
};

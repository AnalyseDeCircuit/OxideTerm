/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // Catppuccin Mocha 调色盘
      colors: {
        // Base colors
        base: '#1e1e2e',
        mantle: '#181825',
        crust: '#11111b',
        surface: {
          0: '#313244',
          1: '#45475a',
          2: '#585b70',
        },
        overlay: {
          0: '#6c7086',
          1: '#7f849c',
          2: '#9399b2',
        },
        text: '#cdd6f4',
        subtext: {
          0: '#a6adc8',
          1: '#bac2de',
        },
        // Accent colors
        lavender: '#b4befe',
        blue: '#89b4fa',
        sapphire: '#74c7ec',
        sky: '#89dceb',
        teal: '#94e2d5',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        peach: '#fab387',
        maroon: '#eba0ac',
        red: '#f38ba8',
        mauve: '#cba6f7',
        pink: '#f5c2e7',
        flamingo: '#f2cdcd',
        rosewater: '#f5e0dc',
        // Semantic colors
        sidebar: {
          bg: 'rgba(24, 24, 37, 0.8)',     // mantle with opacity
          border: '#313244',
          hover: 'rgba(49, 50, 68, 0.6)',
          active: 'rgba(137, 180, 250, 0.15)',
        },
        titlebar: {
          bg: 'rgba(17, 17, 27, 0.9)',     // crust with opacity
          text: '#cdd6f4',
        },
        tab: {
          bg: '#181825',
          active: '#1e1e2e',
          hover: '#313244',
          border: '#313244',
        },
        // Terminal colors (for theme system)
        terminal: {
          bg: '#1e1e2e',
          fg: '#cdd6f4',
          black: '#45475a',
          red: '#f38ba8',
          green: '#a6e3a1',
          yellow: '#f9e2af',
          blue: '#89b4fa',
          magenta: '#f5c2e7',
          cyan: '#94e2d5',
          white: '#bac2de',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(137, 180, 250, 0.15)',
        'glow-sm': '0 0 10px rgba(137, 180, 250, 0.1)',
        'inner-glow': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
      },
      animation: {
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-out-right': 'slideOutRight 0.3s ease-in',
        'fade-in': 'fadeIn 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideOutRight: {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      transitionDuration: {
        '250': '250ms',
      },
      spacing: {
        'titlebar': '38px',  // macOS titlebar height
        'sidebar': '240px',
        'sidebar-collapsed': '48px',
      },
    },
  },
  plugins: [],
}

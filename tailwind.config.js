/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // Catppuccin Mocha 调色盘 - Using CSS Variables for theming
      colors: {
        // Base layers (using CSS variables)
        crust:   'var(--crust)',
        mantle:  'var(--mantle)',
        base:    'var(--base)',
        surface: {
          0: 'var(--surface0)',
          1: 'var(--surface1)',
          2: 'var(--surface2)',
        },
        overlay: {
          0: 'var(--overlay0)',
          1: 'var(--overlay1)',
          2: 'var(--overlay2)',
        },
        // Text hierarchy
        text:    'var(--text)',
        subtext: {
          0: 'var(--subtext0)',
          1: 'var(--subtext1)',
        },
        // Accent colors
        mauve:     'var(--mauve)',
        lavender:  'var(--lavender)',
        blue:      'var(--blue)',
        sapphire:  'var(--sapphire)',
        sky:       'var(--sky)',
        teal:      'var(--teal)',
        green:     'var(--green)',
        yellow:    'var(--yellow)',
        peach:     'var(--peach)',
        maroon:    'var(--maroon)',
        red:       'var(--red)',
        pink:      'var(--pink)',
        flamingo:  'var(--flamingo)',
        rosewater: 'var(--rosewater)',
        // Semantic colors
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover:   'var(--color-primary-hover)',
          muted:   'var(--color-primary-muted)',
        },
        success: {
          DEFAULT: 'var(--color-success)',
          muted:   'var(--color-success-muted)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          muted:   'var(--color-warning-muted)',
        },
        error: {
          DEFAULT: 'var(--color-error)',
          muted:   'var(--color-error-muted)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          muted:   'var(--color-info-muted)',
        },
        // Component-specific
        sidebar: {
          bg:       'var(--sidebar-bg)',
          'bg-solid': 'var(--sidebar-bg-solid)',
          border:   'var(--sidebar-border)',
          hover:    'var(--overlay-hover)',
          active:   'var(--overlay-active)',
        },
        tab: {
          bg:     'var(--tab-bg)',
          active: 'var(--tab-bg-active)',
          hover:  'var(--tab-bg-hover)',
          border: 'var(--tab-border)',
        },
        panel: {
          bg:     'var(--panel-bg)',
          border: 'var(--panel-border)',
        },
        terminal: {
          bg: 'var(--terminal-bg)',
          fg: 'var(--terminal-fg)',
        },
      },
      fontFamily: {
        mono: ['var(--font-mono)', 'JetBrains Mono', 'Fira Code', 'SF Mono', 'monospace'],
        sans: ['var(--font-sans)', 'Inter', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'xs':   'var(--text-xs)',
        'sm':   'var(--text-sm)',
        'base': 'var(--text-base)',
        'md':   'var(--text-md)',
        'lg':   'var(--text-lg)',
        'xl':   'var(--text-xl)',
        '2xl':  'var(--text-2xl)',
        '3xl':  'var(--text-3xl)',
      },
      spacing: {
        'titlebar': '38px',
        'sidebar':  'var(--sidebar-width)',
        'sidebar-collapsed': 'var(--sidebar-width-collapsed)',
        'tabbar':   'var(--tabbar-height)',
        '0.5': 'var(--space-1)',
        '1':   'var(--space-2)',
        '1.5': 'var(--space-3)',
        '2':   'var(--space-4)',
        '3':   'var(--space-5)',
        '4':   'var(--space-6)',
        '6':   'var(--space-8)',
        '8':   'var(--space-10)',
      },
      borderRadius: {
        'sm':   'var(--radius-sm)',
        'md':   'var(--radius-md)',
        'lg':   'var(--radius-lg)',
        'xl':   'var(--radius-xl)',
        '2xl':  'var(--radius-2xl)',
        'full': 'var(--radius-full)',
      },
      backdropBlur: {
        xs: '2px',
        glass: 'var(--glass-blur)',
      },
      boxShadow: {
        'xs':    'var(--shadow-xs)',
        'sm':    'var(--shadow-sm)',
        'md':    'var(--shadow-md)',
        'lg':    'var(--shadow-lg)',
        'xl':    'var(--shadow-xl)',
        '2xl':   'var(--shadow-2xl)',
        'glow':       'var(--shadow-glow)',
        'glow-sm':    'var(--shadow-glow-sm)',
        'glow-lg':    'var(--shadow-glow-lg)',
        'glow-blue':  'var(--shadow-glow-blue)',
        'glow-green': 'var(--shadow-glow-green)',
        'glow-red':   'var(--shadow-glow-red)',
        'inner':      'var(--shadow-inner)',
        'inner-glow': 'var(--shadow-inner-glow)',
      },
      transitionDuration: {
        'fast':   'var(--duration-fast)',
        'normal': 'var(--duration-normal)',
        'slow':   'var(--duration-slow)',
        'slower': 'var(--duration-slower)',
      },
      transitionTimingFunction: {
        'expo-out':  'var(--ease-expo-out)',
        'quart-out': 'var(--ease-quart-out)',
        'bounce':    'var(--ease-bounce)',
      },
      zIndex: {
        'dropdown':       'var(--z-dropdown)',
        'sticky':         'var(--z-sticky)',
        'fixed':          'var(--z-fixed)',
        'modal-backdrop': 'var(--z-modal-backdrop)',
        'modal':          'var(--z-modal)',
        'popover':        'var(--z-popover)',
        'tooltip':        'var(--z-tooltip)',
        'toast':          'var(--z-toast)',
        'max':            'var(--z-max)',
      },
      animation: {
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-out-right': 'slideOutRight 0.3s ease-in',
        'fade-in': 'fadeIn 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'skeleton': 'skeleton 1.5s ease-in-out infinite',
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
        skeleton: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}


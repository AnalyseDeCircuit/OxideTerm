# OxideTerm Fonts

This directory contains three monospace fonts with Nerd Font support for terminal use.

## Installed Fonts

### 1. JetBrains Mono Nerd Font
**Location**: `JetBrainsMono/`
**License**: OFL (Open Font License) - see `JetBrainsMono/OFL.txt`
**Variants**: Regular, Bold, Italic, BoldItalic
**Description**: Modern, developer-focused monospace font with excellent readability

### 2. MesloLGM Nerd Font
**Location**: `Meslo/`
**License**: Apache 2.0 - see `Meslo/LICENSE.txt`
**Variants**: Regular, Bold, Italic, BoldItalic
**Description**: Customized version of Apple's Menlo, with medium line gap (LGM)

### 3. Tinos Nerd Font
**Location**: `Tinos/`
**License**: Apache 2.0 - see `Tinos/Apache License.txt`
**Variants**: Regular, Bold, Italic, BoldItalic
**Description**: Times New Roman-inspired monospace font

## Font Selection

All fonts can be selected via:
**Settings → Terminal → Font Family**

Available options:
- JetBrains Mono (default)
- MesloLGM Nerd Font
- Tinos Nerd Font

## Technical Details

- All fonts include **Nerd Font** icons and glyphs
- Only **Mono** variants are included (fixed-width characters)
- Fonts are loaded via `@font-face` in `src/styles.css`
- Font switching is handled by `TerminalView.tsx` using xterm.js

## Cleanup Notes

The original font packages contained 96+ files with multiple variants (Propo, NL, etc.).
We've retained only the essential **Mono** variants (4 files per family) to reduce bundle size
while maintaining full functionality for terminal use.

---

Last updated: 2026-01-13

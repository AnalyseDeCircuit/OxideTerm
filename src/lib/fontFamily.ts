/**
 * Shared font-family resolution for xterm.js terminal instances.
 *
 * Maps preset font names to full CSS font stacks with CJK fallback.
 * Used by TerminalView, LocalTerminalView, and CastPlayer.
 *
 * 🎯 CJK 策略: 所有字体都 fallback 到 Maple Mono NF CN
 *    拉丁字母 → 用户选择的字体
 *    中日韩字符 → Maple Mono NF CN
 */

/** CJK fallback font for Chinese/Japanese/Korean character support */
const CJK_FALLBACK = '"Maple Mono NF CN (Subset)"';

/**
 * Resolve a preset font name (or custom value) into a full CSS font-family stack.
 *
 * @param fontFamily   Preset key: 'jetbrains' | 'meslo' | 'maple' | 'cascadia' | 'consolas' | 'menlo' | 'custom'
 * @param customFontFamily  User-specified font stack when `fontFamily === 'custom'`
 * @returns A CSS font-family string ready for xterm.js
 */
export function getFontFamily(fontFamily: string, customFontFamily?: string): string {
  // 自定义轨道: 用户输入优先，添加 CJK fallback
  if (fontFamily === 'custom' && customFontFamily?.trim()) {
    const stack = customFontFamily.trim();
    // 如果已有 monospace，在其前插入 CJK fallback
    if (stack.toLowerCase().includes('monospace')) {
      return stack.replace(/,?\s*monospace\s*$/i, `, ${CJK_FALLBACK}, monospace`);
    }
    return `${stack}, ${CJK_FALLBACK}, monospace`;
  }

  // 预设轨道: 拉丁字符用选定字体，CJK 字符 fallback 到 Maple Mono
  switch (fontFamily) {
    case 'jetbrains':
      return `"JetBrainsMono Nerd Font", "JetBrainsMono Nerd Font Mono", "JetBrains Mono NF (Subset)", "JetBrains Mono", ${CJK_FALLBACK}, monospace`;
    case 'meslo':
      return `"MesloLGM Nerd Font", "MesloLGM Nerd Font Mono", "MesloLGM NF (Subset)", "Meslo LG M", ${CJK_FALLBACK}, monospace`;
    case 'maple':
      return '"Maple Mono NF CN (Subset)", "Maple Mono NF", "Maple Mono", monospace';
    case 'cascadia':
      return `"Cascadia Code NF", "Cascadia Mono NF", "Cascadia Code", "Cascadia Mono", ${CJK_FALLBACK}, monospace`;
    case 'consolas':
      return `Consolas, "Courier New", ${CJK_FALLBACK}, monospace`;
    case 'menlo':
      return `Menlo, Monaco, "Courier New", ${CJK_FALLBACK}, monospace`;
    default:
      return `"JetBrainsMono Nerd Font", "JetBrainsMono Nerd Font Mono", "JetBrains Mono NF (Subset)", "JetBrains Mono", ${CJK_FALLBACK}, monospace`;
  }
}

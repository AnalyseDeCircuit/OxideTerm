/**
 * 平台检测工具
 * 用于实现平台特定的性能优化
 */
export const platform = {
  isWindows: navigator.platform.toLowerCase().includes('win'),
  isMac: navigator.platform.toLowerCase().includes('mac'),
  isLinux: navigator.platform.toLowerCase().includes('linux'),

  // 调试用
  userAgent: navigator.userAgent,
  language: navigator.language,
};

// 开发环境输出平台信息
if (import.meta.env.DEV) {
  console.log('[Platform]', {
    isWindows: platform.isWindows,
    isMac: platform.isMac,
    isLinux: platform.isLinux,
    platform: navigator.platform,
  });
}

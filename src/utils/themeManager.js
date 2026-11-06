import { themeColors } from '../constants/appConstants';
import { shadeColor, hexToRgbString } from './formatters';

const STYLE_ID = 'nexus-theme-styles';

/**
 * Ensures the global dynamic theme override stylesheet is injected into <head> once.
 * All rules rely on CSS variables on :root, enabling 60-120fps GPU-accelerated updates
 * with ZERO stylesheet rebuilds and ZERO layout thrashing.
 */
export function ensureThemeStylesheet() {
  if (typeof document === 'undefined') return;
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      :root {
        --theme-main: #8b5cf6;
        --theme-hover: #7c3aed;
        --theme-light: #f5f3ff;
        --theme-text-light: #8b5cf6;
        --theme-shadow: rgba(139, 92, 246, 0.35);
        --theme-gradient-from: #8b5cf6;
        --theme-gradient-to: #7c3aed;
        --theme-logo-bg: linear-gradient(135deg, #8b5cf6, #7c3aed);
        --theme-gradient-image: linear-gradient(to right, #8b5cf6, #7c3aed);
        --theme-gradient-fallback-bg: transparent;
      }
      
      /* Backgrounds */
      .bg-indigo-600, .bg-violet-600 { background-color: var(--theme-main) !important; }
      .hover\\:bg-indigo-700:hover, .hover\\:bg-violet-700:hover { background-color: var(--theme-hover) !important; }
      .bg-indigo-50, .bg-violet-50, .bg-violet-50\\/40, .bg-violet-50\\/50, .bg-violet-50\\/60, .bg-violet-50\\/70 { background-color: var(--theme-light) !important; }
      .bg-indigo-100, .bg-violet-100, .bg-violet-100\\/70, .bg-violet-100\\/80 { background-color: var(--theme-light) !important; filter: brightness(0.95); }
      .hover\\:bg-violet-100:hover { background-color: var(--theme-light) !important; filter: brightness(0.92); }
      .hover\\:bg-violet-50\\/50:hover, .hover\\:bg-violet-50\\/40:hover, .hover\\:bg-violet-50\\/20:hover { background-color: var(--theme-light) !important; }
      
      /* Texts */
      .text-indigo-600, .text-violet-600 { color: var(--theme-main) !important; }
      .text-indigo-700, .text-violet-700, .text-indigo-800, .text-violet-800, .text-violet-900, .text-violet-950 { color: var(--theme-hover) !important; }
      .text-indigo-500, .text-violet-500 { color: var(--theme-text-light) !important; }
      .hover\\:text-violet-700:hover { color: var(--theme-hover) !important; }
      .hover\\:text-violet-600:hover { color: var(--theme-main) !important; }
      
      /* Borders */
      .border-indigo-100, .border-indigo-200, .border-violet-100, .border-violet-100\\/60, .border-violet-100\\/80, .border-violet-100\\/90, .border-violet-200, .border-violet-200\\/60, .border-violet-200\\/80 { border-color: var(--theme-light) !important; filter: brightness(0.9); }
      .border-indigo-600, .border-violet-600, .border-violet-500, .border-violet-400 { border-color: var(--theme-main) !important; }
      .hover\\:border-indigo-300:hover, .hover\\:border-violet-300:hover { border-color: var(--theme-text-light) !important; opacity: 0.8; }
      .focus-within\\:border-violet-400:focus-within { border-color: var(--theme-main) !important; }

      /* Focus & Accents */
      .accent-indigo-600, .accent-violet-600 { accent-color: var(--theme-main) !important; }
      .focus\\:ring-indigo-500:focus, .focus\\:ring-indigo-500\\/20:focus, .focus\\:ring-violet-500:focus, .focus\\:ring-violet-500\\/20:focus, .ring-violet-500 { --tw-ring-color: var(--theme-main) !important; }
      .focus-within\\:ring-violet-500\\/20:focus-within { --tw-ring-color: var(--theme-main) !important; }
      .focus\\:border-indigo-500:focus, .focus\\:border-violet-500:focus { border-color: var(--theme-main) !important; }

      /* Shadows */
      .shadow-indigo-200, .shadow-violet-200, .shadow-violet-200\\/40, .shadow-violet-200\\/50, .shadow-violet-200\\/60, .shadow-violet-300 { --tw-shadow-color: var(--theme-shadow) !important; }
      
      /* Gradients */
      .from-indigo-600, .from-violet-600, .from-violet-500 { 
          --tw-gradient-from: var(--theme-gradient-from) !important; 
          --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, var(--theme-gradient-to)) !important; 
      }
      .to-violet-600, .to-purple-600, .to-purple-500 { --tw-gradient-to: var(--theme-gradient-to) !important; }
      .theme-logo-bg {
          background: var(--theme-logo-bg) !important;
          box-shadow: 0 10px 15px -3px var(--theme-shadow) !important;
      }
      .theme-gradient,
      .bg-gradient-to-r.from-violet-600,
      .bg-gradient-to-r.from-indigo-600,
      .from-violet-600.to-purple-600 {
          background-image: var(--theme-gradient-image) !important;
          background-color: var(--theme-gradient-fallback-bg) !important;
      }
    `;
    document.head.appendChild(style);
  }
}

let syncBc = null;

/**
 * High-reliability BroadcastChannel singleton.
 * Prevents dropping messages due to immediate .close() calls.
 */
export function broadcastShopInfoSync(shopInfo) {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      if (!syncBc) {
        syncBc = new BroadcastChannel('flower2u_sync_channel');
      }
      syncBc.postMessage({ type: 'SHOP_INFO_SYNC', shopInfo });
    }
  } catch (e) {}
}

/**
 * Computes theme colors structure from current selection.
 */
export function computeThemeColors(themeColor, themeMode, customColorValue) {
  let theme;
  const isGradient = themeMode === 'gradient';

  if (themeColor === 'custom' && customColorValue) {
    const mainColor = customColorValue;
    theme = {
      main: mainColor,
      hover: shadeColor(mainColor, -0.1),
      light: shadeColor(mainColor, 0.93),
      textLight: mainColor,
      gradientFrom: mainColor,
      gradientTo: shadeColor(mainColor, -0.25),
      shadow: `rgba(${hexToRgbString(mainColor)}, 0.4)`
    };
  } else {
    theme = themeColors[themeColor] || themeColors.violet;
  }

  const logoBg = !isGradient
    ? theme.main
    : (theme.isRainbow
        ? 'linear-gradient(135deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #a855f7, #ec4899)'
        : `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`);

  const gradientImage = !isGradient
    ? 'none'
    : (theme.isRainbow
        ? 'linear-gradient(to right, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #a855f7, #ec4899)'
        : `linear-gradient(to right, ${theme.gradientFrom}, ${theme.gradientTo})`);

  const gradientFallbackBg = !isGradient ? theme.main : 'transparent';

  return { theme, logoBg, gradientImage, gradientFallbackBg };
}

/**
 * High-performance, sub-millisecond CSS variable updater.
 * Directly applies theme styles to :root without rebuilding or invalidating stylesheets.
 */
export function applyThemeVariables(themeColor, themeMode, customColorValue) {
  if (typeof document === 'undefined') return;
  ensureThemeStylesheet();
  const { theme, logoBg, gradientImage, gradientFallbackBg } = computeThemeColors(themeColor, themeMode, customColorValue);
  const root = document.documentElement;

  root.style.setProperty('--theme-main', theme.main);
  root.style.setProperty('--theme-hover', theme.hover);
  root.style.setProperty('--theme-light', theme.light);
  root.style.setProperty('--theme-text-light', theme.textLight);
  root.style.setProperty('--theme-shadow', theme.shadow);
  root.style.setProperty('--theme-gradient-from', theme.gradientFrom);
  root.style.setProperty('--theme-gradient-to', theme.gradientTo);
  root.style.setProperty('--theme-logo-bg', logoBg);
  root.style.setProperty('--theme-gradient-image', gradientImage);
  root.style.setProperty('--theme-gradient-fallback-bg', gradientFallbackBg);
}

(function () {
  var LIGHT_THEME_COLOR = '#f5f7f3';
  var DARK_THEME_COLOR = '#0a0b0a';
  var preference = 'system';
  var highContrast = false;

  try {
    var storedPreference = window.localStorage.getItem('vite-ui-theme');
    if (storedPreference === 'light' || storedPreference === 'dark' || storedPreference === 'system') {
      preference = storedPreference;
    }
    highContrast = window.localStorage.getItem('vite-ui-high-contrast') === 'true';
  } catch (_error) {
    // Storage can be blocked in hardened/private browser contexts. System
    // preference remains a safe, deterministic first-paint fallback.
  }

  var systemPrefersDark = typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  var resolvedTheme = preference === 'system'
    ? (systemPrefersDark ? 'dark' : 'light')
    : preference;
  var root = document.documentElement;
  var themeColor = document.querySelector('meta[name="theme-color"]');

  root.classList.remove('light', 'dark');
  root.classList.add(resolvedTheme);
  if (highContrast) {
    root.classList.add('high-contrast');
  }
  root.style.colorScheme = resolvedTheme;
  if (themeColor) {
    themeColor.setAttribute(
      'content',
      resolvedTheme === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR,
    );
  }
})();

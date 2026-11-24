// Runs before the app loads so the page never flashes the wrong theme.
// Keep in sync with src/app/theme.ts (storage key + values).
(function () {
  var pref = 'dark';
  try {
    var saved = localStorage.getItem('pos-theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') pref = saved;
  } catch (e) {
    /* storage unavailable: use default */
  }
  var dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  var root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0a0f15' : '#1b2735');
})();

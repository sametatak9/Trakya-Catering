// Tema tercihi yalnızca bu tarayıcıya ait bir kolaylıktır.
export type Theme = 'light' | 'dark';
const KEY = 'tc_theme';

export function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* depolama kapalı olabilir */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#16140F' : '#B4432A');
  try { localStorage.setItem(KEY, t); } catch { /* yok say */ }
}

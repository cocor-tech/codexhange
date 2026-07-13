'use client';

import { useState, useEffect } from 'react';

const THEME_KEY = 'codexhange-theme';

function getStoredTheme(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'dark') return true;
  if (stored === 'light') return false;
  return false;
}

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle('light', !dark);
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const isDark = getStoredTheme();
    setDark(isDark);
    applyTheme(isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    applyTheme(next);
  };

  return (
    <button
      onClick={toggle}
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--hover-overlay)] text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      aria-label="Toggle theme"
    >
      {dark ? (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

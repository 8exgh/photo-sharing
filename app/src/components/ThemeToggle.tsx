'use client';

import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [light, setLight] = useState(false);

  // The anti-FOUC script in the layout sets the class before hydration;
  // sync state from the DOM after mount (server always renders the dark position).
  useEffect(() => {
    setLight(document.documentElement.classList.contains('light'));
  }, []);

  const toggle = () => {
    const next = !light;
    document.documentElement.classList.toggle('light', next);
    try {
      localStorage.setItem('theme', next ? 'light' : 'dark');
    } catch {
      // localStorage unavailable (private mode) - theme still applies for this page
    }
    setLight(next);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={light}
      aria-label={light ? 'Switch to dark theme' : 'Switch to light theme'}
      onClick={toggle}
      className="fixed top-0 left-1/2 -translate-x-1/2 z-50 flex h-7 w-16 items-center rounded-b-xl border border-t-0 border-slate-600 bg-slate-700 px-1.5 shadow-md cursor-pointer"
    >
      <svg
        className="absolute left-2 h-3.5 w-3.5 text-yellow-400"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
          clipRule="evenodd"
        />
      </svg>
      <svg
        className="absolute right-2 h-3.5 w-3.5 text-slate-300"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
      </svg>
      <span
        className={`absolute left-1 h-5 w-5 rounded-full bg-slate-100 shadow transition-transform duration-200 ${
          light ? 'translate-x-0' : 'translate-x-9'
        }`}
      />
    </button>
  );
}

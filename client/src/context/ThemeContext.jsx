/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect } from 'react';

export const ThemeContext = createContext();

export const themes = {
  slate: {
    name: 'Slate & Blue',
    isDark: false,
    bg: 'bg-slate-50 text-slate-800',
    sidebar: 'bg-white border-slate-200',
    sidebarHeader: 'border-slate-200',
    textPrimary: 'text-slate-800',
    textSecondary: 'text-slate-500',
    textBrand: 'text-blue-600',
    btnBrand: 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-100',
    btnSec: 'text-slate-600 hover:bg-slate-100 border border-slate-200',
    border: 'border-slate-200',
    card: 'bg-white border-slate-200 shadow-sm',
    blockNoteTheme: 'light',
    chatBg: 'bg-slate-50',
    inputBg: 'bg-white',
    badgeBg: 'bg-blue-50 text-blue-700',
  },
  forest: {
    name: 'Dark Forest',
    isDark: true,
    bg: 'bg-zinc-950 text-zinc-100',
    sidebar: 'bg-zinc-900 border-emerald-950/40',
    sidebarHeader: 'border-emerald-950/40',
    textPrimary: 'text-zinc-100',
    textSecondary: 'text-zinc-400',
    textBrand: 'text-emerald-400',
    btnBrand: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-950/50',
    btnSec: 'text-zinc-300 hover:bg-zinc-800 border border-zinc-800',
    border: 'border-zinc-800',
    card: 'bg-zinc-900 border-zinc-800/80 shadow-md',
    blockNoteTheme: 'dark',
    chatBg: 'bg-zinc-950/80',
    inputBg: 'bg-zinc-850',
    badgeBg: 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/20',
  },
  sunset: {
    name: 'Warm Sunset',
    isDark: false,
    bg: 'bg-stone-50 text-stone-850',
    sidebar: 'bg-orange-50/40 border-stone-200',
    sidebarHeader: 'border-stone-200',
    textPrimary: 'text-stone-850',
    textSecondary: 'text-stone-500',
    textBrand: 'text-rose-600',
    btnBrand: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-100',
    btnSec: 'text-stone-600 hover:bg-stone-150 border border-stone-200',
    border: 'border-stone-200',
    card: 'bg-white border-stone-200 shadow-sm',
    blockNoteTheme: 'light',
    chatBg: 'bg-orange-50/20',
    inputBg: 'bg-white',
    badgeBg: 'bg-rose-50 text-rose-700',
  },
  cyberpunk: {
    name: 'Cyberpunk',
    isDark: true,
    bg: 'bg-neutral-950 text-neutral-50',
    sidebar: 'bg-neutral-900 border-purple-950/40',
    sidebarHeader: 'border-purple-950/40',
    textPrimary: 'text-neutral-50',
    textSecondary: 'text-neutral-400',
    textBrand: 'text-fuchsia-500',
    btnBrand: 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white shadow-sm shadow-fuchsia-950/50',
    btnSec: 'text-neutral-300 hover:bg-neutral-800 border border-neutral-800',
    border: 'border-purple-950/20',
    card: 'bg-neutral-900 border-purple-950/35 shadow-lg',
    blockNoteTheme: 'dark',
    chatBg: 'bg-neutral-950',
    inputBg: 'bg-neutral-850',
    badgeBg: 'bg-fuchsia-950/40 text-fuchsia-400 border border-fuchsia-800/20',
  },
};

export const ThemeProvider = ({ children }) => {
  const [themeName, setThemeName] = useState(() => {
    return localStorage.getItem('notes-theme') || 'slate';
  });

  const activeTheme = themes[themeName] || themes.slate;

  useEffect(() => {
    localStorage.setItem('notes-theme', themeName);
    // Apply default document body styles if dark mode
    const body = document.body;
    if (activeTheme.isDark) {
      body.classList.add('dark');
      body.style.backgroundColor = '#09090b'; // matching zinc-950/neutral-950 approx
    } else {
      body.classList.remove('dark');
      body.style.backgroundColor = '#f8fafc'; // matching slate-50
    }
  }, [themeName, activeTheme]);

  return (
    <ThemeContext.Provider value={{ themeName, setThemeName, activeTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
};

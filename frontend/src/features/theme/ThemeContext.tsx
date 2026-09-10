import React, { createContext, useContext, useEffect } from 'react';

// ── BuildFeed is dark-only. Light mode has been removed. ──
// The ThemeContext is kept so existing consumers (`useTheme`) don't break,
// but theme is always 'dark' and toggleTheme is a no-op.

type Theme = 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme:    (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Always apply dark class on mount and keep it there.
  useEffect(() => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('build_theme', 'dark');
  }, []);

  const noop = () => {};   // toggleTheme / setTheme are no-ops

  return (
    <ThemeContext.Provider value={{ theme: 'dark', toggleTheme: noop, setTheme: noop }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
};

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from './useTheme';

export const ThemeToggle: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      title={isDark ? 'Passer en mode clair (Thème Jour)' : 'Passer en mode sombre (Thème Nuit)'}
      className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-850 dark:text-amber-400 dark:hover:bg-slate-800 transition-colors"
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber-400 transition-transform rotate-0 hover:rotate-45" />
      ) : (
        <Moon className="h-4 w-4 text-slate-600 transition-transform -rotate-12 hover:rotate-0" />
      )}
    </button>
  );
};

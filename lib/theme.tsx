import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';
type ResolvedTheme = 'light' | 'dark';

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  border: string;
  primary: string;
  primaryText: string;
  primarySoft: string;
  primarySoftText: string;
  success: string;
  successSoft: string;
  successText: string;
  danger: string;
  dangerSoft: string;
  dangerText: string;
  warningSoft: string;
  warningText: string;
  shadow: string;
  overlay: string;
  input: string;
  disabled: string;
};

const lightColors: ThemeColors = {
  background: '#f8fafc',
  surface: '#fff',
  surfaceMuted: '#f3f4f6',
  text: '#111827',
  textMuted: '#374151',
  textSubtle: '#6b7280',
  border: '#e5e7eb',
  primary: '#111827',
  primaryText: '#fff',
  primarySoft: '#eef2ff',
  primarySoftText: '#3730a3',
  success: '#15803d',
  successSoft: '#dcfce7',
  successText: '#15803d',
  danger: '#b91c1c',
  dangerSoft: '#fee2e2',
  dangerText: '#b91c1c',
  warningSoft: '#fef3c7',
  warningText: '#b45309',
  shadow: '#0f172a',
  overlay: 'rgba(15, 23, 42, 0.55)',
  input: '#f9fafb',
  disabled: '#e5e7eb',
};

const darkColors: ThemeColors = {
  background: '#0f172a',
  surface: '#1e293b',
  surfaceMuted: '#334155',
  text: '#f8fafc',
  textMuted: '#cbd5e1',
  textSubtle: '#94a3b8',
  border: '#334155',
  primary: '#f8fafc',
  primaryText: '#0f172a',
  primarySoft: '#312e81',
  primarySoftText: '#c7d2fe',
  success: '#86efac',
  successSoft: '#14532d',
  successText: '#bbf7d0',
  danger: '#fca5a5',
  dangerSoft: '#7f1d1d',
  dangerText: '#fecaca',
  warningSoft: '#78350f',
  warningText: '#fde68a',
  shadow: '#020617',
  overlay: 'rgba(2, 6, 23, 0.72)',
  input: '#0f172a',
  disabled: '#475569',
};

const STORAGE_KEY = 'togeco_theme_preference';

const ThemeContext = createContext<{
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  colors: ThemeColors;
  isDark: boolean;
  setPreference: (preference: ThemePreference) => void;
  toggleTheme: () => void;
} | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'system' || stored === 'light' || stored === 'dark') setPreferenceState(stored);
    }).catch(() => undefined);
  }, []);

  const setPreference = (nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
    AsyncStorage.setItem(STORAGE_KEY, nextPreference).catch(() => undefined);
  };

  const resolvedTheme: ResolvedTheme = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const colors = resolvedTheme === 'dark' ? darkColors : lightColors;

  const value = useMemo(() => ({
    preference,
    resolvedTheme,
    colors,
    isDark: resolvedTheme === 'dark',
    setPreference,
    toggleTheme: () => setPreference(resolvedTheme === 'dark' ? 'light' : 'dark'),
  }), [colors, preference, resolvedTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}

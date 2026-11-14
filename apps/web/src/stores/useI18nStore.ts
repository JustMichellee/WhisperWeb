import { create } from 'zustand';
import { en } from '../i18n/en';
import { id } from '../i18n/id';
import { ja } from '../i18n/ja';
import { LOCALE_OPTIONS, type Locale, type Translations } from '../i18n/types';
import { zh } from '../i18n/zh';

export { LOCALE_OPTIONS, type Locale, type Translations } from '../i18n/types';

const STORAGE_KEY = 'whisperweb:lang';

export const DICTIONARIES: Record<Locale, Translations> = {
  id,
  en,
  ja,
  zh,
};

type DotKeys<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : DotKeys<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TranslationKey = DotKeys<Translations>;
export type TranslationVars = Record<string, string | number>;

function isValidLocale(value: unknown): value is Locale {
  return value === 'id' || value === 'en' || value === 'ja' || value === 'zh';
}

function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return 'id';
  const lang = (navigator.language || '').toLowerCase();
  if (lang.startsWith('ja')) return 'ja';
  if (lang.startsWith('zh')) return 'zh';
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('id')) return 'id';
  return 'id';
}

function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'id';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isValidLocale(saved)) return saved;
  } catch {
    // ignore storage errors
  }
  return detectBrowserLocale();
}

function applyLocaleToDocument(locale: Locale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.title = DICTIONARIES[locale].common.appTitle;
}

export function getDateLocale(locale: Locale): string {
  return LOCALE_OPTIONS.find((item) => item.code === locale)?.dateLocale ?? 'id-ID';
}

function resolveKey(dict: Translations, key: TranslationKey): string {
  const parts = key.split('.');
  let current: unknown = dict;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  return typeof current === 'string' ? current : key;
}

export function translate(locale: Locale, key: TranslationKey, vars?: TranslationVars): string {
  const dict = DICTIONARIES[locale] ?? DICTIONARIES.id;
  let value = resolveKey(dict, key);
  if (vars) {
    for (const [varKey, varVal] of Object.entries(vars)) {
      value = value.replaceAll(`{${varKey}}`, String(varVal));
    }
  }
  return value;
}

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const initialLocale = getInitialLocale();
applyLocaleToDocument(initialLocale);

export const useI18nStore = create<I18nState>((set) => ({
  locale: initialLocale,
  setLocale: (locale) => {
    const nextLocale: Locale = isValidLocale(locale) ? locale : 'id';
    try {
      window.localStorage.setItem(STORAGE_KEY, nextLocale);
    } catch {
      // ignore storage errors
    }
    applyLocaleToDocument(nextLocale);
    set({ locale: nextLocale });
  },
}));

export function useT() {
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);
  const dateLocale = getDateLocale(locale);
  const t = (key: TranslationKey, vars?: TranslationVars) => translate(locale, key, vars);
  return { t, locale, dateLocale, setLocale };
}

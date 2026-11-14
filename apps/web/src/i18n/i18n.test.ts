import { describe, expect, it } from 'vitest';
import {
  DICTIONARIES,
  LOCALE_OPTIONS,
  getDateLocale,
  translate,
  useI18nStore,
  type Locale,
} from '../stores/useI18nStore';

function collectKeys(obj: unknown, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return [];
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') {
      keys.push(next);
    } else {
      keys.push(...collectKeys(v, next));
    }
  }
  return keys;
}

describe('i18n dictionaries and store', () => {
  it('supports Indonesian, English, Japanese, and Simplified Chinese', () => {
    const codes = LOCALE_OPTIONS.map((item) => item.code);
    expect(codes).toEqual(['id', 'en', 'ja', 'zh']);
    expect(getDateLocale('id')).toBe('id-ID');
    expect(getDateLocale('en')).toBe('en-US');
    expect(getDateLocale('ja')).toBe('ja-JP');
    expect(getDateLocale('zh')).toBe('zh-CN');
  });

  it('has identical translation keys and non-empty strings across all locales', () => {
    const baseKeys = collectKeys(DICTIONARIES.id).sort();
    for (const locale of ['en', 'ja', 'zh'] as Locale[]) {
      const targetKeys = collectKeys(DICTIONARIES[locale]).sort();
      expect(targetKeys).toEqual(baseKeys);
      for (const key of targetKeys) {
        const value = translate(locale, key as never);
        expect(value.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('interpolates template variables cleanly in every language', () => {
    expect(translate('id', 'common.memberCount', { count: 4 })).toBe('4 anggota');
    expect(translate('en', 'common.memberCount', { count: 4 })).toBe('4 members');
    expect(translate('ja', 'common.memberCount', { count: 4 })).toBe('4人のメンバー');
    expect(translate('zh', 'common.memberCount', { count: 4 })).toBe('4 位成员');
  });

  it('updates document language, title, and store state when switching locale', () => {
    const storageMap = new Map<string, string>();
    const fakeDocument = { documentElement: { lang: '' }, title: '' };
    const prevDoc = (globalThis as { document?: unknown }).document;
    const prevWin = (globalThis as { window?: unknown }).window;

    Object.assign(globalThis, {
      document: fakeDocument,
      window: {
        localStorage: {
          getItem: (k: string) => storageMap.get(k) ?? null,
          setItem: (k: string, v: string) => {
            storageMap.set(k, v);
          },
        },
      },
    });

    try {
      const { setLocale } = useI18nStore.getState();
      setLocale('ja');
      expect(useI18nStore.getState().locale).toBe('ja');
      expect(fakeDocument.documentElement.lang).toBe('ja');
      expect(fakeDocument.title).toBe(DICTIONARIES.ja.common.appTitle);
      expect(storageMap.get('whisperweb:lang')).toBe('ja');

      setLocale('zh');
      expect(useI18nStore.getState().locale).toBe('zh');
      expect(fakeDocument.documentElement.lang).toBe('zh');
      expect(storageMap.get('whisperweb:lang')).toBe('zh');

      setLocale('en');
      expect(useI18nStore.getState().locale).toBe('en');
      expect(fakeDocument.documentElement.lang).toBe('en');

      setLocale('id');
      expect(useI18nStore.getState().locale).toBe('id');
    } finally {
      Object.assign(globalThis, { document: prevDoc, window: prevWin });
    }
  });
});

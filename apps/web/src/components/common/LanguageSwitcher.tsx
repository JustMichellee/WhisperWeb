import type { FC } from 'react';
import { Globe } from 'lucide-react';
import { LOCALE_OPTIONS, useT, type Locale } from '../../stores/useI18nStore';

interface LanguageSwitcherProps {
  compact?: boolean;
  className?: string;
}

export const LanguageSwitcher: FC<LanguageSwitcherProps> = ({
  compact = false,
  className = '',
}) => {
  const { locale, setLocale, t } = useT();

  return (
    <label
      className={`inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer ${
        compact ? 'px-2 py-1.5 justify-center' : 'px-2.5 py-1.5'
      } ${className}`}
      title={t('common.languageLabel')}
    >
      <Globe className="w-4 h-4 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label={t('common.languageLabel')}
        className={`bg-transparent text-xs font-medium text-[var(--text-primary)] focus:outline-none cursor-pointer ${
          compact ? 'w-11' : 'min-w-[7.25rem]'
        }`}
      >
        {LOCALE_OPTIONS.map((option) => (
          <option
            key={option.code}
            value={option.code}
            className="bg-[var(--bg-sidebar)] text-[var(--text-primary)]"
          >
            {compact ? option.shortLabel : option.label}
          </option>
        ))}
      </select>
    </label>
  );
};

import { useState, type FC, type FormEvent } from 'react';
import { AlertCircle, KeyRound, Lock, MessageCircle, Moon, Sun } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useT } from '../../stores/useI18nStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { LanguageSwitcher } from '../common/LanguageSwitcher';

type AuthTab = 'login' | 'register' | 'recover';

export const AuthScreen: FC = () => {
  const {
    loginWithPassword,
    loginWithPasskey,
    register,
    recoverAccount,
    pendingVaultUnlock,
    unlockPendingVaultWithPassword,
    unlockPendingVaultWithRecovery,
    logout,
  } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const { t } = useT();

  const [tab, setTab] = useState<AuthTab>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [unlockMode, setUnlockMode] = useState<'password' | 'recovery'>('password');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (tab === 'login') {
        await loginWithPassword({ username, password });
      } else if (tab === 'register') {
        await register({ username, displayName, password });
      } else {
        await recoverAccount({ username, recoveryCode, newPassword: password });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.genericError'));
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithPasskey(username || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.passkeyError'));
    } finally {
      setLoading(false);
    }
  };

  const handleUnlockVault = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (unlockMode === 'password') {
        await unlockPendingVaultWithPassword(password);
      } else {
        await unlockPendingVaultWithRecovery(recoveryCode);
      }
    } catch {
      setError(
        unlockMode === 'password' ? t('auth.unlockPasswordError') : t('auth.unlockRecoveryError')
      );
    } finally {
      setLoading(false);
    }
  };

  if (pendingVaultUnlock) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-4 bg-[var(--bg-app)] relative">
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <LanguageSwitcher />
        </div>
        <section className="w-full max-w-md rounded-3xl bg-[var(--bg-sidebar)] border border-[var(--border-subtle)] p-7 shadow-xl space-y-5">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-[var(--bg-app)] flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-[var(--status-e2ee)]" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">{t('auth.unlockTitle')}</h1>
              <p className="text-sm text-[var(--text-secondary)]">
                @{pendingVaultUnlock.user.username}
              </p>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            {t('auth.unlockDesc')}
          </p>

          <div
            role="tablist"
            aria-label={t('auth.unlockAriaLabel')}
            className="grid grid-cols-2 gap-1 p-1 rounded-full bg-[var(--bg-app)]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={unlockMode === 'password'}
              onClick={() => {
                setUnlockMode('password');
                setError(null);
              }}
              className={`py-2 px-3 rounded-full text-xs font-semibold transition-colors ${
                unlockMode === 'password'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-fg)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t('auth.unlockPasswordTab')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={unlockMode === 'recovery'}
              onClick={() => {
                setUnlockMode('recovery');
                setError(null);
              }}
              className={`py-2 px-3 rounded-full text-xs font-semibold transition-colors ${
                unlockMode === 'recovery'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-fg)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t('auth.unlockRecoveryTab')}
            </button>
          </div>

          <form onSubmit={handleUnlockVault} className="space-y-4">
            {unlockMode === 'password' ? (
              <div>
                <label htmlFor="unlock-password" className="block text-sm font-medium mb-1.5">
                  {t('auth.accountPasswordLabel')}
                </label>
                <input
                  id="unlock-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.accountPasswordPlaceholder')}
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-sm"
                />
              </div>
            ) : (
              <div>
                <label htmlFor="unlock-recovery" className="block text-sm font-medium mb-1.5">
                  {t('auth.recoveryKeyLabel')}
                </label>
                <input
                  id="unlock-recovery"
                  type="text"
                  required
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  placeholder={t('auth.recoveryKeyPlaceholder')}
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-subtle)] font-mono-code text-sm"
                />
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 p-3 rounded-xl border border-[var(--status-danger)] text-sm text-[var(--status-danger)]"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => void logout()}
                className="px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--bg-hover)]"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-fg)] font-semibold text-sm hover:bg-[var(--accent-hover)] disabled:opacity-60"
              >
                {loading ? t('auth.unlockSubmitLoading') : t('auth.unlockSubmit')}
              </button>
            </div>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-4 sm:p-6 bg-[var(--bg-app)] text-[var(--text-primary)] relative">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2">
        <LanguageSwitcher />
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
          className="px-3.5 py-2 rounded-full bg-[var(--bg-sidebar)] border border-[var(--border-subtle)] text-xs font-medium flex items-center gap-2 text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-[var(--status-e2ee)]" aria-hidden="true" />
              <span className="hidden sm:inline">{t('common.lightMode')}</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-[var(--status-e2ee)]" aria-hidden="true" />
              <span className="hidden sm:inline">{t('common.darkMode')}</span>
            </>
          )}
        </button>
      </div>

      <section className="w-full max-w-[430px] md:max-w-4xl rounded-2xl bg-[var(--bg-sidebar)] border border-[var(--border-subtle)] shadow-xl overflow-hidden grid md:grid-cols-[1fr_410px]">
        <div className="hidden md:flex flex-col justify-between p-8 bg-[var(--bg-canvas)] border-r border-[var(--border-subtle)]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[var(--bg-sidebar)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)]">
              <MessageCircle className="w-4 h-4 text-[var(--status-e2ee)]" aria-hidden="true" />
              <span>WhisperWeb</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight leading-snug text-[var(--text-primary)]">
                {t('auth.heroTitle')}
              </h1>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                {t('auth.heroSubtitle')}
              </p>
            </div>
          </div>

          <div className="space-y-2.5 pt-6 border-t border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-[var(--status-e2ee)] shrink-0" aria-hidden="true" />
              <span>{t('auth.heroBulletE2ee')}</span>
            </div>
            <div className="flex items-center gap-2">
              <KeyRound className="w-3.5 h-3.5 text-[var(--status-e2ee)] shrink-0" aria-hidden="true" />
              <span>{t('auth.heroBulletPasskey')}</span>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-2">
            <div className="md:hidden w-12 h-12 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-[var(--status-e2ee)]" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight">
                {tab === 'login'
                  ? t('auth.titleLogin')
                  : tab === 'register'
                    ? t('auth.titleRegister')
                    : t('auth.titleRecover')}
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                {tab === 'login'
                  ? t('auth.subtitleLogin')
                  : tab === 'register'
                    ? t('auth.subtitleRegister')
                    : t('auth.subtitleRecover')}
              </p>
            </div>
          </div>

          <div
            role="tablist"
            aria-label={t('auth.authTabAriaLabel')}
            className="grid grid-cols-3 gap-1 p-1 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)]"
          >
            {(
              [
                { id: 'login', label: t('auth.tabLogin') },
                { id: 'register', label: t('auth.tabRegister') },
                { id: 'recover', label: t('auth.tabRecover') },
              ] as const
            ).map((item) => {
              const selected = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => {
                    setTab(item.id);
                    setError(null);
                  }}
                  className={`py-2 text-xs font-semibold rounded-full transition-colors ${
                    selected
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-fg)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="auth-username" className="block text-sm font-medium mb-1.5">
                {t('auth.usernameLabel')}
              </label>
              <input
                id="auth-username"
                type="text"
                autoComplete="username"
                required
                minLength={3}
                maxLength={24}
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder={t('auth.usernamePlaceholder')}
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-sm"
              />
              {tab === 'register' && (
                <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
                  {t('auth.usernameHint')}
                </p>
              )}
            </div>

            {tab === 'register' && (
              <div>
                <label htmlFor="auth-displayname" className="block text-sm font-medium mb-1.5">
                  {t('auth.displayNameLabel')}
                </label>
                <input
                  id="auth-displayname"
                  type="text"
                  required
                  maxLength={48}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('auth.displayNamePlaceholder')}
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-sm"
                />
              </div>
            )}

            {tab === 'recover' && (
              <div>
                <label htmlFor="auth-recovery" className="block text-sm font-medium mb-1.5">
                  {t('auth.recoveryKeyLabel')}
                </label>
                <input
                  id="auth-recovery"
                  type="text"
                  required
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  placeholder={t('auth.recoveryKeyPlaceholder')}
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-subtle)] font-mono-code text-sm"
                />
              </div>
            )}

            <div>
              <label htmlFor="auth-password" className="block text-sm font-medium mb-1.5">
                {tab === 'recover' ? t('auth.newPasswordLabel') : t('auth.passwordLabel')}
              </label>
              <input
                id="auth-password"
                type="password"
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder')}
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-sm"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 p-3 rounded-xl border border-[var(--status-danger)] text-sm text-[var(--status-danger)]"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-fg)] font-semibold text-sm hover:bg-[var(--accent-hover)] disabled:opacity-60"
            >
              {loading
                ? t('auth.submitLoading')
                : tab === 'login'
                  ? t('auth.submitLogin')
                  : tab === 'register'
                    ? t('auth.submitRegister')
                    : t('auth.submitRecover')}
            </button>

            {tab === 'login' && (
              <button
                type="button"
                disabled={loading}
                onClick={() => void handlePasskeyLogin()}
                className="w-full py-2.5 px-4 rounded-xl bg-transparent text-[var(--text-primary)] border border-[var(--border-subtle)] font-medium text-sm flex items-center justify-center gap-2 hover:bg-[var(--bg-hover)] disabled:opacity-60"
              >
                <KeyRound className="w-4 h-4" aria-hidden="true" />
                <span>{t('auth.passkeyLogin')}</span>
              </button>
            )}
          </form>

          <div className="flex md:hidden items-center justify-center gap-1.5 text-xs text-[var(--text-secondary)] pt-1">
            <Lock className="w-3.5 h-3.5 text-[var(--status-e2ee)] shrink-0" aria-hidden="true" />
            <span>{t('auth.heroMobileNote')}</span>
          </div>
        </div>
      </section>
    </main>
  );
};

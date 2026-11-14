import { useState, type FC, type FormEvent } from 'react';
import { AlertCircle, KeyRound, Lock, MessageCircle, Moon, Sun } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useThemeStore } from '../../stores/useThemeStore';

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
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses akun.');
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
      setError(err instanceof Error ? err.message : 'Autentikasi Passkey dibatalkan atau gagal.');
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
        unlockMode === 'password'
          ? 'Password tidak cocok untuk membuka kunci enkripsi Anda.'
          : 'Recovery Key tidak cocok untuk membuka kunci enkripsi Anda.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (pendingVaultUnlock) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-4 bg-[var(--bg-app)]">
        <section className="w-full max-w-md rounded-3xl bg-[var(--bg-sidebar)] border border-[var(--border-subtle)] p-7 shadow-xl space-y-5">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-[var(--bg-app)] flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-[var(--status-e2ee)]" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Buka Obrolan</h1>
              <p className="text-sm text-[var(--text-secondary)]">
                @{pendingVaultUnlock.user.username}
              </p>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            Passkey terverifikasi. Masukkan password atau Recovery Key untuk membuka kunci obrolan
            di perangkat ini.
          </p>

          <div
            role="tablist"
            aria-label="Metode buka kunci"
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
              Password
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
              Recovery Key
            </button>
          </div>

          <form onSubmit={handleUnlockVault} className="space-y-4">
            {unlockMode === 'password' ? (
              <div>
                <label htmlFor="unlock-password" className="block text-sm font-medium mb-1.5">
                  Password Akun
                </label>
                <input
                  id="unlock-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password Anda"
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-sm"
                />
              </div>
            ) : (
              <div>
                <label htmlFor="unlock-recovery" className="block text-sm font-medium mb-1.5">
                  Recovery Key (24 Karakter)
                </label>
                <input
                  id="unlock-recovery"
                  type="text"
                  required
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
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
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-fg)] font-semibold text-sm hover:bg-[var(--accent-hover)] disabled:opacity-60"
              >
                {loading ? 'Membuka...' : 'Buka & Lanjut'}
              </button>
            </div>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-4 sm:p-6 bg-[var(--bg-app)] text-[var(--text-primary)] relative">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 px-3.5 py-2 rounded-full bg-[var(--bg-sidebar)] border border-[var(--border-subtle)] text-xs font-medium flex items-center gap-2 text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
      >
        {theme === 'dark' ? (
          <>
            <Sun className="w-4 h-4 text-[var(--status-e2ee)]" aria-hidden="true" />
            <span>Mode Terang</span>
          </>
        ) : (
          <>
            <Moon className="w-4 h-4 text-[var(--status-e2ee)]" aria-hidden="true" />
            <span>Mode Gelap</span>
          </>
        )}
      </button>

      <section className="w-full max-w-[430px] rounded-3xl bg-[var(--bg-sidebar)] border border-[var(--border-subtle)] p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col items-center text-center space-y-2.5">
          <div className="w-12 h-12 rounded-2xl bg-[var(--bg-app)] flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-[var(--status-e2ee)]" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">WhisperWeb</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Ruang ngobrol santai, ringan, dan terenkripsi tanpa nomor HP.
            </p>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Pilihan autentikasi"
          className="grid grid-cols-3 gap-1 p-1 rounded-full bg-[var(--bg-app)]"
        >
          {(
            [
              { id: 'login', label: 'Masuk' },
              { id: 'register', label: 'Daftar' },
              { id: 'recover', label: 'Pulihkan' },
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
                    ? 'bg-[var(--bg-sidebar)] text-[var(--text-primary)] shadow-sm'
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
              Username
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
              placeholder="misal: budi_santoso"
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-sm"
            />
            {tab === 'register' && (
              <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
                Pakai huruf kecil, angka, atau garis bawah (3 sampai 24 karakter).
              </p>
            )}
          </div>

          {tab === 'register' && (
            <div>
              <label htmlFor="auth-displayname" className="block text-sm font-medium mb-1.5">
                Nama Panggilan
              </label>
              <input
                id="auth-displayname"
                type="text"
                required
                maxLength={48}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nama yang tampil di obrolan"
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-sm"
              />
            </div>
          )}

          {tab === 'recover' && (
            <div>
              <label htmlFor="auth-recovery" className="block text-sm font-medium mb-1.5">
                Recovery Key (24 Karakter)
              </label>
              <input
                id="auth-recovery"
                type="text"
                required
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-subtle)] font-mono-code text-sm"
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-password" className="block text-sm font-medium mb-1.5">
              {tab === 'recover' ? 'Password Baru' : 'Password'}
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
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
              ? 'Menyiapkan obrolan...'
              : tab === 'login'
                ? 'Masuk'
                : tab === 'register'
                  ? 'Daftar & Mulai Chat'
                  : 'Pulihkan Akun'}
          </button>

          {tab === 'login' && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void handlePasskeyLogin()}
              className="w-full py-2.5 px-4 rounded-xl bg-transparent text-[var(--text-primary)] border border-[var(--border-subtle)] font-medium text-sm flex items-center justify-center gap-2 hover:bg-[var(--bg-hover)] disabled:opacity-60"
            >
              <KeyRound className="w-4 h-4" aria-hidden="true" />
              <span>Masuk pakai Passkey</span>
            </button>
          )}
        </form>

        <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--text-secondary)] pt-1">
          <Lock className="w-3.5 h-3.5 text-[var(--status-e2ee)] shrink-0" aria-hidden="true" />
          <span>Pesan terkunci otomatis di perangkat Anda.</span>
        </div>
      </section>
    </main>
  );
};

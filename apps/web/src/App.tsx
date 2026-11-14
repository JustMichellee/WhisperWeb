import { useEffect, type FC } from 'react';
import { Lock } from 'lucide-react';
import { AuthScreen } from './components/auth/AuthScreen';
import { ChatLayout } from './components/layout/ChatLayout';
import { useAuthStore } from './stores/useAuthStore';
import { useT } from './stores/useI18nStore';

export const App: FC = () => {
  const { isHydrating, token, user, privateKey, hydrate } = useAuthStore();
  const { t } = useT();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (isHydrating) {
    return (
      <main className="h-dvh flex flex-col items-center justify-center gap-3 bg-[var(--bg-app)] text-[var(--text-primary)]">
        <Lock className="w-8 h-8 text-[var(--accent-primary)]" aria-hidden="true" />
        <p className="text-sm text-[var(--text-secondary)]">{t('auth.submitLoading')}</p>
      </main>
    );
  }

  if (!token || !user || !privateKey) {
    return <AuthScreen />;
  }

  return <ChatLayout />;
};

export default App;


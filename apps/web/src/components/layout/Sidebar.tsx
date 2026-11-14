import { useEffect, useState, type FC, type RefObject } from 'react';
import {
  AlertCircle,
  LogOut,
  Moon,
  Search,
  Settings,
  Sun,
  UserPlus,
  Users,
} from 'lucide-react';
import type { UserPublicDto } from '@chat/shared';
import { apiClient } from '../../services/api';
import { useAuthStore } from '../../stores/useAuthStore';
import { useChatStore, type UiConversation } from '../../stores/useChatStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { Avatar } from '../common/Avatar';

type FilterTab = 'all' | 'unread' | 'group';

interface SidebarProps {
  searchInputRef: RefObject<HTMLInputElement | null>;
  onOpenNewGroup: () => void;
  onOpenSettings: () => void;
}

function formatListTime(ts: number | null): string {
  if (!ts) return '';
  const date = new Date(ts);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
}

export const Sidebar: FC<SidebarProps> = ({
  searchInputRef,
  onOpenNewGroup,
  onOpenSettings,
}) => {
  const { user, token, privateKey, logout } = useAuthStore();
  const {
    conversations,
    conversationsLoading,
    conversationsError,
    activeConversationId,
    typingByConv,
    wsConnected,
    selectConversation,
    startDirectChat,
    refreshConversations,
    resetSession,
  } = useChatStore();
  const { theme, toggleTheme } = useThemeStore();

  const [query, setQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [userSearchResults, setUserSearchResults] = useState<UserPublicDto[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  useEffect(() => {
    if (!token) return;
    const cleaned = query.trim().replace(/^@/, '');
    if (cleaned.length < 2) {
      setUserSearchResults([]);
      return;
    }

    const timer = window.setTimeout(() => {
      setSearchingUsers(true);
      void apiClient
        .searchUsers(token, cleaned)
        .then((res) => setUserSearchResults(res.users))
        .catch(() => setUserSearchResults([]))
        .finally(() => setSearchingUsers(false));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query, token]);

  if (!user || !token || !privateKey) return null;

  const getConversationMeta = (conv: UiConversation) => {
    if (conv.type === 'group') {
      return {
        title: conv.name ?? 'Grup Tanpa Nama',
        subtitle: `${conv.members.length} anggota`,
        avatarUrl: conv.avatarUrl,
        isOnline: false,
        isGroup: true,
      };
    }
    const peer = conv.members.find((m) => m.userId !== user.id);
    return {
      title: peer?.displayName ?? 'Pengguna',
      subtitle: `@${peer?.username ?? ''}`,
      avatarUrl: peer?.avatarUrl ?? null,
      isOnline: peer?.isOnline ?? false,
      isGroup: false,
    };
  };

  const normalizedQuery = query.trim().toLowerCase().replace(/^@/, '');

  const filteredConversations = conversations.filter((conv) => {
    if (filterTab === 'unread' && conv.unreadCount === 0) return false;
    if (filterTab === 'group' && conv.type !== 'group') return false;
    if (!normalizedQuery) return true;
    const meta = getConversationMeta(conv);
    return (
      meta.title.toLowerCase().includes(normalizedQuery) ||
      meta.subtitle.toLowerCase().includes(normalizedQuery) ||
      (conv.lastDecryptedText ?? '').toLowerCase().includes(normalizedQuery)
    );
  });

  const handleStartDirect = async (target: UserPublicDto) => {
    await startDirectChat(target.id, token, user, privateKey);
    setQuery('');
    setUserSearchResults([]);
  };

  const handleLogout = async () => {
    resetSession();
    await logout();
  };

  return (
    <aside
      aria-label="Daftar percakapan"
      className="w-full md:w-[340px] lg:w-[360px] shrink-0 h-full flex flex-col bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)] md:border md:rounded-[26px] overflow-hidden"
    >
      <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar
            name={user.displayName}
            avatarUrl={user.avatarUrl}
            isOnline={wsConnected}
            size="md"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{user.displayName}</p>
            <p className="text-xs text-[var(--text-secondary)] truncate">
              {wsConnected ? 'Terhubung' : 'Menghubungkan'} · @{user.username}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-0.5 p-1 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] shrink-0">
          <button
            type="button"
            onClick={onOpenNewGroup}
            aria-label="Buat grup baru"
            title="Buat Grup Baru"
            className="min-w-[36px] min-h-[36px] p-1.5 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center justify-center"
          >
            <Users className="w-[17px] h-[17px]" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Ubah ke mode terang' : 'Ubah ke mode gelap'}
            title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
            className="min-w-[36px] min-h-[36px] p-1.5 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center justify-center"
          >
            {theme === 'dark' ? (
              <Sun className="w-[17px] h-[17px]" aria-hidden="true" />
            ) : (
              <Moon className="w-[17px] h-[17px]" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Pengaturan profil dan Passkey"
            title="Profil & Pengaturan"
            className="min-w-[36px] min-h-[36px] p-1.5 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center justify-center"
          >
            <Settings className="w-[17px] h-[17px]" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => void handleLogout()}
            aria-label="Keluar dari akun"
            title="Keluar"
            className="min-w-[36px] min-h-[36px] p-1.5 rounded-full text-[var(--text-secondary)] hover:text-[var(--status-danger)] hover:bg-[var(--bg-hover)] flex items-center justify-center"
          >
            <LogOut className="w-[17px] h-[17px]" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="px-3.5 pb-3 space-y-2.5 shrink-0">
        <div className="relative">
          <label htmlFor="sidebar-search" className="sr-only">
            Cari percakapan atau username baru
          </label>
          <Search
            className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
            aria-hidden="true"
          />
          <input
            ref={searchInputRef}
            id="sidebar-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari obrolan atau @username..."
            className="w-full pl-10 pr-4 py-2 rounded-full bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] border border-[var(--border-subtle)] text-sm"
          />
        </div>

        <div role="tablist" aria-label="Filter percakapan" className="flex items-center gap-1.5">
          {(
            [
              { id: 'all', label: 'Semua' },
              { id: 'unread', label: 'Belum Dibaca' },
              { id: 'group', label: 'Grup' },
            ] as const
          ).map((t) => {
            const active = filterTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilterTab(t.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs transition-colors ${
                  active
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-fg)] font-semibold'
                    : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {normalizedQuery.length >= 2 && (
          <div className="mb-3 pb-2 border-b border-[var(--border-subtle)]">
            <p className="px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
              Orang baru (@username)
            </p>
            {searchingUsers ? (
              <p className="px-3 py-2.5 text-xs text-[var(--text-secondary)]">Mencari @{normalizedQuery}...</p>
            ) : userSearchResults.length === 0 ? (
              <p className="px-3 py-2.5 text-xs text-[var(--text-secondary)]">
                Tidak ada pengguna dengan awalan @{normalizedQuery}.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {userSearchResults.map((candidate) => (
                  <li key={candidate.id}>
                    <button
                      type="button"
                      onClick={() => void handleStartDirect(candidate)}
                      className="w-full px-3 py-2 rounded-2xl flex items-center justify-between gap-3 text-left hover:bg-[var(--bg-hover)]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          name={candidate.displayName}
                          avatarUrl={candidate.avatarUrl}
                          isOnline={candidate.isOnline}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{candidate.displayName}</p>
                          <p className="text-xs text-[var(--text-secondary)] truncate">
                            @{candidate.username}
                          </p>
                        </div>
                      </div>
                      <UserPlus className="w-4 h-4 text-[var(--status-e2ee)] shrink-0" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {conversationsLoading && conversations.length === 0 ? (
          <div className="p-6 text-center space-y-1.5">
            <p className="text-sm font-medium">Memuat obrolan...</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Menyiapkan riwayat pesan Anda.
            </p>
          </div>
        ) : conversationsError ? (
          <div role="alert" className="p-4 m-2 rounded-2xl border border-[var(--status-danger)] space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--status-danger)]">
              <AlertCircle className="w-4 h-4" aria-hidden="true" />
              <span>Gagal Memuat Obrolan</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">{conversationsError}</p>
            <button
              type="button"
              onClick={() => void refreshConversations(token, user, privateKey)}
              className="px-3.5 py-1.5 rounded-full border border-[var(--border-subtle)] text-xs font-medium hover:bg-[var(--bg-hover)]"
            >
              Coba Lagi
            </button>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <p className="text-sm font-medium">
              {normalizedQuery
                ? 'Tidak ada obrolan yang cocok'
                : filterTab === 'unread'
                  ? 'Semua pesan sudah dibaca'
                  : 'Belum ada obrolan'}
            </p>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Ketik <span className="text-[var(--text-primary)]">@username</span> teman di kotak
              cari atas untuk mulai ngobrol.
            </p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {filteredConversations.map((conv) => {
              const meta = getConversationMeta(conv);
              const isActive = conv.id === activeConversationId;
              const typingIds = typingByConv[conv.id] ?? [];
              const previewText =
                typingIds.length > 0
                  ? 'sedang mengetik...'
                  : conv.lastDecryptedText ?? 'Obrolan baru';

              return (
                <li key={conv.id}>
                  <button
                    type="button"
                    onClick={() => void selectConversation(conv.id, token, user, privateKey)}
                    className={`w-full px-3 py-2.5 rounded-2xl flex items-center gap-3 text-left transition-colors ${
                      isActive ? 'bg-[var(--bg-active)]' : 'hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <Avatar
                      name={meta.title}
                      avatarUrl={meta.avatarUrl}
                      isOnline={meta.isOnline}
                      isGroup={meta.isGroup}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold truncate">{meta.title}</p>
                        <span
                          className={`text-xs tabular-nums shrink-0 ${
                            conv.unreadCount > 0
                              ? 'text-[var(--status-e2ee)] font-semibold'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          {formatListTime(conv.lastMessageAt ?? conv.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p
                          className={`text-[13.5px] truncate ${
                            typingIds.length > 0
                              ? 'text-[var(--status-e2ee)] font-medium'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          {previewText}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--accent-primary)] text-[var(--accent-fg)] text-[11px] font-bold tabular-nums flex items-center justify-center shrink-0">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
};

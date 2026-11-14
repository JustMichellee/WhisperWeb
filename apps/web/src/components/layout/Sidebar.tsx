import { useEffect, useState, type FC, type RefObject } from 'react';
import {
  AlertCircle,
  Inbox,
  LogOut,
  MessageSquare,
  MessageSquareDot,
  Moon,
  PanelLeft,
  RefreshCcw,
  Search,
  Settings,
  Sun,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type { UserPublicDto } from '@chat/shared';
import { apiClient } from '../../services/api';
import { useAuthStore } from '../../stores/useAuthStore';
import { useChatStore, type UiConversation } from '../../stores/useChatStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { Avatar } from '../common/Avatar';
import type { ChatFolderTab } from './AppRail';

interface SidebarProps {
  searchInputRef: RefObject<HTMLInputElement | null>;
  filterTab: ChatFolderTab;
  onChangeFilterTab: (tab: ChatFolderTab) => void;
  railCollapsed: boolean;
  onToggleRail: () => void;
  onOpenNewGroup: () => void;
  onOpenSettings: () => void;
}

const FOLDER_META: Record<
  ChatFolderTab,
  { title: string; shortLabel: string; icon: typeof Inbox }
> = {
  all: { title: 'Semua Obrolan', shortLabel: 'Semua', icon: Inbox },
  unread: { title: 'Belum Dibaca', shortLabel: 'Belum Dibaca', icon: MessageSquareDot },
  direct: { title: 'Pesan Langsung', shortLabel: 'Direct', icon: MessageSquare },
  group: { title: 'Ruang Grup', shortLabel: 'Grup', icon: Users },
};

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
  filterTab,
  onChangeFilterTab,
  railCollapsed,
  onToggleRail,
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
  const unreadTotal = conversations.reduce((acc, c) => acc + c.unreadCount, 0);

  const filteredConversations = conversations.filter((conv) => {
    if (filterTab === 'unread' && conv.unreadCount === 0) return false;
    if (filterTab === 'direct' && conv.type !== 'direct') return false;
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

  const activeFolder = FOLDER_META[filterTab];

  return (
    <aside
      aria-label="Daftar percakapan"
      className="w-full md:w-[272px] lg:w-[324px] xl:w-[352px] shrink-0 h-full flex flex-col bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)] md:border md:rounded-2xl shadow-sm overflow-hidden"
    >
      <div className="min-h-14 px-3.5 py-2 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onToggleRail}
            aria-label={railCollapsed ? 'Perluas panel navigasi' : 'Ciutkan panel navigasi'}
            title={railCollapsed ? 'Perluas navigasi' : 'Ciutkan navigasi'}
            className="hidden md:inline-flex w-8 h-8 rounded-lg items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors shrink-0"
          >
            <PanelLeft className="w-4 h-4" aria-hidden="true" />
          </button>

          <div className="md:hidden shrink-0">
            <Avatar
              name={user.displayName}
              avatarUrl={user.avatarUrl}
              isOnline={wsConnected}
              size="sm"
            />
          </div>

          <h1 className="text-sm font-semibold truncate text-[var(--text-primary)]">
            {activeFolder.title}
          </h1>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => void refreshConversations(token, user, privateKey)}
            disabled={conversationsLoading}
            aria-label="Segarkan daftar obrolan"
            title="Segarkan"
            className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <RefreshCcw
              className={`w-3.5 h-3.5 ${conversationsLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
          </button>

          <div className="flex md:hidden items-center gap-0.5">
            <button
              type="button"
              onClick={onOpenNewGroup}
              aria-label="Buat grup baru"
              title="Buat Grup Baru"
              className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            >
              <Users className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Ubah ke mode terang' : 'Ubah ke mode gelap'}
              className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label="Pengaturan profil dan Passkey"
              className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            >
              <Settings className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              aria-label="Keluar dari akun"
              className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--status-danger)] hover:bg-[var(--bg-hover)]"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-3.5 pt-3 pb-2.5 space-y-2 shrink-0">
        <div className="relative flex items-center">
          <label htmlFor="sidebar-search" className="sr-only">
            Cari percakapan atau username baru
          </label>
          <Search
            className="w-3.5 h-3.5 absolute left-3 text-[var(--text-secondary)] pointer-events-none"
            aria-hidden="true"
          />
          <input
            ref={searchInputRef}
            id="sidebar-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari obrolan atau @username..."
            className="w-full h-9 pl-9 pr-14 rounded-lg bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] border border-[var(--border-subtle)] text-[13px]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Bersihkan pencarian"
              className="absolute right-2 p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          ) : (
            <kbd
              aria-hidden="true"
              className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[10px] font-medium text-[var(--text-secondary)] absolute right-2 pointer-events-none"
            >
              Ctrl K
            </kbd>
          )}
        </div>

        <div
          role="tablist"
          aria-label="Filter percakapan"
          className="flex items-center gap-1.5"
        >
          {(['all', 'unread', 'direct', 'group'] as const).map((tabId) => {
            const meta = FOLDER_META[tabId];
            const Icon = meta.icon;
            const active = filterTab === tabId;
            return (
              <button
                key={tabId}
                type="button"
                role="tab"
                aria-selected={active}
                title={meta.title}
                onClick={() => onChangeFilterTab(tabId)}
                className={`relative h-8 flex items-center justify-center gap-1.5 rounded-lg text-xs transition-all duration-200 ${
                  active
                    ? 'flex-1 px-3 bg-[var(--accent-primary)] text-[var(--accent-fg)] font-semibold shadow-sm'
                    : 'w-9 border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {active && <span className="truncate">{meta.shortLabel}</span>}
                {!active && tabId === 'unread' && unreadTotal > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div
        aria-hidden="true"
        className={`h-0.5 w-full bg-[var(--accent-primary)] transition-opacity shrink-0 ${
          conversationsLoading ? 'opacity-100 animate-pulse' : 'opacity-0'
        }`}
      />

      <div className="flex-1 overflow-y-auto px-2 pb-3 pt-1">
        {normalizedQuery.length >= 2 && (
          <div className="mb-3 pb-2 border-b border-[var(--border-subtle)]">
            <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Orang baru (@username)
            </p>
            {searchingUsers ? (
              <p className="px-2.5 py-2 text-xs text-[var(--text-secondary)]">
                Mencari @{normalizedQuery}...
              </p>
            ) : userSearchResults.length === 0 ? (
              <p className="px-2.5 py-2 text-xs text-[var(--text-secondary)]">
                Tidak ada pengguna dengan awalan @{normalizedQuery}.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {userSearchResults.map((candidate) => (
                  <li key={candidate.id}>
                    <button
                      type="button"
                      onClick={() => void handleStartDirect(candidate)}
                      className="w-full px-2.5 py-2 rounded-xl flex items-center justify-between gap-3 text-left hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar
                          name={candidate.displayName}
                          avatarUrl={candidate.avatarUrl}
                          isOnline={candidate.isOnline}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium truncate">{candidate.displayName}</p>
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
          <div role="alert" className="p-4 m-2 rounded-xl border border-[var(--status-danger)] space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--status-danger)]">
              <AlertCircle className="w-4 h-4" aria-hidden="true" />
              <span>Gagal Memuat Obrolan</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">{conversationsError}</p>
            <button
              type="button"
              onClick={() => void refreshConversations(token, user, privateKey)}
              className="px-3.5 py-1.5 rounded-lg border border-[var(--border-subtle)] text-xs font-medium hover:bg-[var(--bg-hover)]"
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
                  : filterTab === 'group'
                    ? 'Belum ada ruang grup'
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
                    className={`group relative w-full px-3 py-2.5 rounded-xl flex items-center gap-3 text-left transition-colors border ${
                      isActive
                        ? 'bg-[var(--bg-active)] border-[var(--border-subtle)]'
                        : 'border-transparent hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {conv.unreadCount > 0 && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-2.5 left-0.5 w-1 rounded-full bg-[var(--accent-primary)]"
                      />
                    )}

                    <Avatar
                      name={meta.title}
                      avatarUrl={meta.avatarUrl}
                      isOnline={meta.isOnline}
                      isGroup={meta.isGroup}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p
                          className={`text-[13.5px] truncate ${
                            conv.unreadCount > 0 ? 'font-semibold' : 'font-medium'
                          }`}
                        >
                          {meta.title}
                        </p>
                        <span
                          className={`text-[11px] tabular-nums shrink-0 ${
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
                          className={`text-xs truncate ${
                            typingIds.length > 0
                              ? 'text-[var(--status-e2ee)] font-medium'
                              : conv.unreadCount > 0
                                ? 'text-[var(--text-primary)]'
                                : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          {previewText}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-[var(--accent-primary)] text-[var(--accent-fg)] text-[10px] font-bold tabular-nums flex items-center justify-center shrink-0">
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

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
import { useT } from '../../stores/useI18nStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { Avatar } from '../common/Avatar';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
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

const FOLDER_ICONS: Record<ChatFolderTab, typeof Inbox> = {
  all: Inbox,
  unread: MessageSquareDot,
  direct: MessageSquare,
  group: Users,
};

function formatListTime(ts: number | null, dateLocale: string): string {
  if (!ts) return '';
  const date = new Date(ts);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString(dateLocale, { day: '2-digit', month: '2-digit' });
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
  const { t, dateLocale } = useT();

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

  const folderMeta: Record<ChatFolderTab, { title: string; shortLabel: string; icon: typeof Inbox }> = {
    all: { title: t('rail.folderAll'), shortLabel: t('rail.shortAll'), icon: FOLDER_ICONS.all },
    unread: {
      title: t('rail.folderUnread'),
      shortLabel: t('rail.shortUnread'),
      icon: FOLDER_ICONS.unread,
    },
    direct: {
      title: t('rail.folderDirect'),
      shortLabel: t('rail.shortDirect'),
      icon: FOLDER_ICONS.direct,
    },
    group: { title: t('rail.folderGroup'), shortLabel: t('rail.shortGroup'), icon: FOLDER_ICONS.group },
  };

  const getConversationMeta = (conv: UiConversation) => {
    if (conv.type === 'group') {
      return {
        title: conv.name ?? t('common.unnamedGroup'),
        subtitle: t('common.memberCount', { count: conv.members.length }),
        avatarUrl: conv.avatarUrl,
        isOnline: false,
        isGroup: true,
      };
    }
    const peer = conv.members.find((m) => m.userId !== user.id);
    return {
      title: peer?.displayName ?? t('common.unknownUser'),
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

  const activeFolder = folderMeta[filterTab];

  return (
    <aside
      aria-label={t('sidebar.ariaLabel')}
      className="w-full md:w-[272px] lg:w-[324px] xl:w-[352px] shrink-0 h-full flex flex-col bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)] md:border md:rounded-2xl shadow-sm overflow-hidden"
    >
      <div className="min-h-14 px-3.5 py-2 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onToggleRail}
            aria-label={railCollapsed ? t('sidebar.expandRail') : t('sidebar.collapseRail')}
            title={railCollapsed ? t('sidebar.expandRail') : t('sidebar.collapseRail')}
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
            aria-label={t('sidebar.refresh')}
            title={t('sidebar.refresh')}
            className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <RefreshCcw
              className={`w-3.5 h-3.5 ${conversationsLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
          </button>

          <div className="flex md:hidden items-center gap-1">
            <LanguageSwitcher compact={true} />
            <button
              type="button"
              onClick={onOpenNewGroup}
              aria-label={t('rail.createGroup')}
              title={t('rail.createGroupTitle')}
              className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            >
              <Users className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
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
              aria-label={t('rail.settingsAria')}
              className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            >
              <Settings className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              aria-label={t('rail.logoutAria')}
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
            {t('sidebar.searchAria')}
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
            placeholder={t('sidebar.searchPlaceholder')}
            className="w-full h-9 pl-9 pr-14 rounded-lg bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] border border-[var(--border-subtle)] text-[13px]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={t('sidebar.clearSearch')}
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
          aria-label={t('sidebar.filterAria')}
          className="flex items-center gap-1.5"
        >
          {(['all', 'unread', 'direct', 'group'] as const).map((tabId) => {
            const meta = folderMeta[tabId];
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
              {t('sidebar.newPeopleHeader')}
            </p>
            {searchingUsers ? (
              <p className="px-2.5 py-2 text-xs text-[var(--text-secondary)]">
                {t('sidebar.searchingUsers', { query: normalizedQuery })}
              </p>
            ) : userSearchResults.length === 0 ? (
              <p className="px-2.5 py-2 text-xs text-[var(--text-secondary)]">
                {t('sidebar.noUserFound', { query: normalizedQuery })}
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
            <p className="text-sm font-medium">{t('sidebar.loadingChats')}</p>
            <p className="text-xs text-[var(--text-secondary)]">
              {t('sidebar.loadingChatsDesc')}
            </p>
          </div>
        ) : conversationsError ? (
          <div role="alert" className="p-4 m-2 rounded-xl border border-[var(--status-danger)] space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--status-danger)]">
              <AlertCircle className="w-4 h-4" aria-hidden="true" />
              <span>{t('sidebar.loadErrorTitle')}</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">{conversationsError}</p>
            <button
              type="button"
              onClick={() => void refreshConversations(token, user, privateKey)}
              className="px-3.5 py-1.5 rounded-lg border border-[var(--border-subtle)] text-xs font-medium hover:bg-[var(--bg-hover)]"
            >
              {t('common.retry')}
            </button>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <p className="text-sm font-medium">
              {normalizedQuery
                ? t('sidebar.emptySearch')
                : filterTab === 'unread'
                  ? t('sidebar.emptyUnread')
                  : filterTab === 'group'
                    ? t('sidebar.emptyGroup')
                    : t('sidebar.emptyAll')}
            </p>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {t('sidebar.emptyHintPrefix')}{' '}
              <span className="text-[var(--text-primary)]">@username</span>{' '}
              {t('sidebar.emptyHintSuffix')}
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
                  ? t('sidebar.typing')
                  : conv.lastDecryptedText ?? t('sidebar.newConversationPreview');

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
                          {formatListTime(conv.lastMessageAt ?? conv.createdAt, dateLocale)}
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

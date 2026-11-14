import type { FC } from 'react';
import {
  Inbox,
  LogOut,
  MessageSquare,
  MessageSquareDot,
  Moon,
  Settings,
  SquarePen,
  Sun,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useChatStore } from '../../stores/useChatStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { Avatar } from '../common/Avatar';

export type ChatFolderTab = 'all' | 'unread' | 'direct' | 'group';

interface AppRailProps {
  collapsed: boolean;
  activeTab: ChatFolderTab;
  onSelectTab: (tab: ChatFolderTab) => void;
  onNewChat: () => void;
  onOpenNewGroup: () => void;
  onOpenSettings: () => void;
}

/**
 * Collapsible left workspace rail inspired by Orbit Mail's AppSidebar,
 * adapted for WhisperWeb E2EE chat folders, new-chat focus, and account actions.
 */
export const AppRail: FC<AppRailProps> = ({
  collapsed,
  activeTab,
  onSelectTab,
  onNewChat,
  onOpenNewGroup,
  onOpenSettings,
}) => {
  const { user, logout } = useAuthStore();
  const { conversations, wsConnected, resetSession } = useChatStore();
  const { theme, toggleTheme } = useThemeStore();

  if (!user) return null;

  const totalCount = conversations.length;
  const unreadTotal = conversations.reduce((acc, c) => acc + c.unreadCount, 0);
  const directCount = conversations.filter((c) => c.type === 'direct').length;
  const groupCount = conversations.filter((c) => c.type === 'group').length;

  const folderItems: Array<{
    id: ChatFolderTab;
    label: string;
    count: number;
    icon: typeof Inbox;
  }> = [
    { id: 'all', label: 'Semua Obrolan', count: totalCount, icon: Inbox },
    { id: 'unread', label: 'Belum Dibaca', count: unreadTotal, icon: MessageSquareDot },
    { id: 'direct', label: 'Pesan Langsung', count: directCount, icon: MessageSquare },
    { id: 'group', label: 'Ruang Grup', count: groupCount, icon: Users },
  ];

  const handleLogout = async () => {
    resetSession();
    await logout();
  };

  return (
    <nav
      aria-label="Navigasi ruang obrolan"
      className={`hidden md:flex shrink-0 h-full flex-col justify-between select-none transition-[width] duration-200 ${
        collapsed ? 'w-[58px] px-1 py-1.5' : 'w-[224px] px-1.5 py-1.5'
      }`}
    >
      <div className="space-y-3.5">
        <button
          type="button"
          onClick={onOpenSettings}
          title={`${user.displayName} (@${user.username})`}
          aria-label="Buka profil dan pengaturan"
          className={`w-full flex items-center rounded-xl transition-colors hover:bg-[var(--bg-hover)] ${
            collapsed ? 'justify-center p-1.5' : 'gap-2.5 px-2 py-1.5 text-left'
          }`}
        >
          <Avatar
            name={user.displayName}
            avatarUrl={user.avatarUrl}
            isOnline={wsConnected}
            size="sm"
          />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold truncate text-[var(--text-primary)]">
                {user.displayName}
              </p>
              <p className="text-[11px] truncate text-[var(--text-secondary)]">
                @{user.username}
              </p>
            </div>
          )}
        </button>

        <div className="space-y-1.5">
          <button
            type="button"
            onClick={onNewChat}
            title="Mulai obrolan baru (Ctrl+K)"
            aria-label="Mulai obrolan baru"
            className={`w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] font-semibold text-xs shadow-sm transition-colors ${
              collapsed ? 'h-9 px-0' : 'h-9 px-3'
            }`}
          >
            <SquarePen className="w-4 h-4 shrink-0" aria-hidden="true" />
            {!collapsed && <span>Obrolan Baru</span>}
          </button>

          <button
            type="button"
            onClick={onOpenNewGroup}
            title="Buat grup terenkripsi baru"
            aria-label="Buat grup baru"
            className={`w-full flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] font-medium text-xs transition-colors ${
              collapsed ? 'justify-center h-8 px-0' : 'justify-center h-8 px-3'
            }`}
          >
            <Users className="w-3.5 h-3.5 shrink-0 text-[var(--status-e2ee)]" aria-hidden="true" />
            {!collapsed && <span>Buat Grup</span>}
          </button>
        </div>

        <div className="space-y-1 pt-1">
          {!collapsed && (
            <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Kotak Obrolan
            </p>
          )}
          <ul className="space-y-0.5">
            {folderItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelectTab(item.id)}
                    title={collapsed ? `${item.label} (${item.count})` : item.label}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full flex items-center rounded-xl text-[13px] transition-colors ${
                      collapsed ? 'justify-center h-9 px-0 relative' : 'justify-between px-2.5 h-9'
                    } ${
                      isActive
                        ? 'bg-[var(--bg-sidebar)] text-[var(--text-primary)] font-semibold border border-[var(--border-subtle)] shadow-sm'
                        : 'text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-[var(--status-e2ee)]' : ''
                        }`}
                        aria-hidden="true"
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </span>
                    {!collapsed && item.count > 0 && (
                      <span
                        className={`ml-2 px-1.5 py-0.5 rounded-md text-[11px] tabular-nums ${
                          item.id === 'unread' && item.count > 0
                            ? 'bg-[var(--accent-primary)] text-[var(--accent-fg)] font-semibold'
                            : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                    {collapsed && item.id === 'unread' && item.count > 0 && (
                      <span
                        aria-hidden="true"
                        className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--accent-primary)]"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="space-y-0.5 pt-3 border-t border-[var(--border-subtle)]/70">
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Ubah ke mode terang' : 'Ubah ke mode gelap'}
          aria-label={theme === 'dark' ? 'Ubah ke mode terang' : 'Ubah ke mode gelap'}
          className={`w-full flex items-center rounded-xl text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors ${
            collapsed ? 'justify-center h-9 px-0' : 'gap-2.5 px-2.5 h-9'
          }`}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 shrink-0" aria-hidden="true" />
          ) : (
            <Moon className="w-4 h-4 shrink-0" aria-hidden="true" />
          )}
          {!collapsed && <span>{theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}</span>}
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          title="Pengaturan profil dan Passkey"
          aria-label="Pengaturan profil dan Passkey"
          className={`w-full flex items-center rounded-xl text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors ${
            collapsed ? 'justify-center h-9 px-0' : 'gap-2.5 px-2.5 h-9'
          }`}
        >
          <Settings className="w-4 h-4 shrink-0" aria-hidden="true" />
          {!collapsed && <span>Pengaturan</span>}
        </button>

        <button
          type="button"
          onClick={() => void handleLogout()}
          title="Keluar dari akun"
          aria-label="Keluar dari akun"
          className={`w-full flex items-center rounded-xl text-[13px] text-[var(--text-secondary)] hover:text-[var(--status-danger)] hover:bg-[var(--bg-hover)] transition-colors ${
            collapsed ? 'justify-center h-9 px-0' : 'gap-2.5 px-2.5 h-9'
          }`}
        >
          <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
          {!collapsed && <span>Keluar</span>}
        </button>
      </div>
    </nav>
  );
};

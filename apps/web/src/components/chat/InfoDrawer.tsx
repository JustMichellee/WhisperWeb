import { useEffect, useRef, useState, type FC, type FormEvent } from 'react';
import {
  Ban,
  Camera,
  FileText,
  Fingerprint,
  Lock,
  LogOut,
  Pencil,
  Search,
  SlidersHorizontal,
  Trash2,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';
import type { UserPublicDto } from '@chat/shared';
import { apiClient } from '../../services/api';
import { useAuthStore } from '../../stores/useAuthStore';
import { useChatStore, type UiConversation } from '../../stores/useChatStore';
import { useT } from '../../stores/useI18nStore';
import { useAvatarCropper } from '../../hooks/useAvatarCropper';
import { Avatar } from '../common/Avatar';
import { AvatarCropModal } from '../common/AvatarCropModal';

interface InfoDrawerProps {
  conversation: UiConversation;
  onClose: () => void;
  onOpenSafetyModal: () => void;
}

export const InfoDrawer: FC<InfoDrawerProps> = ({
  conversation,
  onClose,
  onOpenSafetyModal,
}) => {
  const { user, token, privateKey } = useAuthStore();
  const { t } = useT();
  const {
    messagesByConv,
    blockedUserIds,
    toggleBlockUser,
    updateGroupInfo,
    addGroupMembers,
    removeGroupMemberAndRotate,
  } = useChatStore();

  const [memberQuery, setMemberQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserPublicDto[]>([]);
  const [busyAction, setBusyAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState(false);
  const [groupName, setGroupName] = useState(conversation.name ?? '');
  const [groupDesc, setGroupDesc] = useState(conversation.description ?? '');
  const [groupAvatar, setGroupAvatar] = useState<string | null>(conversation.avatarUrl ?? null);
  const groupIconInputRef = useRef<HTMLInputElement>(null);

  const { cropImageSrc, pickFileForCrop, openExistingForCrop, closeCrop, confirmCrop } =
    useAvatarCropper({
      onApply: setGroupAvatar,
      onError: setActionError,
    });

  useEffect(() => {
    setGroupName(conversation.name ?? '');
    setGroupDesc(conversation.description ?? '');
    setGroupAvatar(conversation.avatarUrl ?? null);
    setEditingGroup(false);
    setActionError(null);
    closeCrop();
  }, [conversation.id, conversation.name, conversation.description, conversation.avatarUrl, closeCrop]);

  if (!user || !token || !privateKey) return null;

  const isGroup = conversation.type === 'group';
  const peer = !isGroup ? conversation.members.find((m) => m.userId !== user.id) : null;
  const myMembership = conversation.members.find((m) => m.userId === user.id);
  const isAdmin = myMembership?.role === 'admin';
  const isBlocked = peer ? blockedUserIds.includes(peer.userId) : false;

  const sharedMedia = (messagesByConv[conversation.id] ?? []).filter(
    (m) => !m.isDeleted && m.decrypted?.media
  );

  const handleSaveGroupEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    setActionError(null);
    setBusyAction(true);
    try {
      await updateGroupInfo(
        conversation.id,
        { name: groupName.trim(), description: groupDesc.trim(), avatarUrl: groupAvatar },
        token,
        user,
        privateKey
      );
      setEditingGroup(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('infoDrawer.updateGroupError'));
    } finally {
      setBusyAction(false);
    }
  };

  const handleSearchUser = async (val: string) => {
    setMemberQuery(val);
    const clean = val.trim().replace(/^@/, '');
    if (clean.length < 2) {
      setSearchResults([]);
      return;
    }
    const res = await apiClient.searchUsers(token, clean).catch(() => ({ users: [] }));
    const existingIds = new Set(conversation.members.map((m) => m.userId));
    setSearchResults(res.users.filter((u) => !existingIds.has(u.id)));
  };

  const handleAddMember = async (target: UserPublicDto) => {
    setActionError(null);
    setBusyAction(true);
    try {
      await addGroupMembers(conversation.id, [target], token, user, privateKey);
      setMemberQuery('');
      setSearchResults([]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('infoDrawer.addMemberError'));
    } finally {
      setBusyAction(false);
    }
  };

  const handleRemoveOrLeave = async (targetUserId: string) => {
    setActionError(null);
    setBusyAction(true);
    try {
      await removeGroupMemberAndRotate(conversation.id, targetUserId, token, user, privateKey);
      if (targetUserId === user.id) {
        onClose();
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('infoDrawer.updateGroupError'));
    } finally {
      setBusyAction(false);
    }
  };

  const handleBlockToggle = async () => {
    if (!peer) return;
    setBusyAction(true);
    try {
      await toggleBlockUser(peer.userId, !isBlocked, token);
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <>
      <aside
        aria-label={t('infoDrawer.ariaLabel')}
        className="fixed inset-y-0 right-0 z-30 w-full sm:w-[330px] lg:static lg:w-[330px] shrink-0 bg-[var(--bg-sidebar)] border-l border-[var(--border-subtle)] lg:border lg:rounded-2xl shadow-sm flex flex-col h-full overflow-hidden"
      >
      <div className="min-h-14 px-4 border-b border-[var(--border-subtle)] flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('infoDrawer.closeAria')}
          className="p-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
        <h2 className="text-base font-semibold">
          {isGroup ? t('infoDrawer.titleGroup') : t('infoDrawer.titleContact')}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        <div className="flex flex-col items-center text-center gap-2.5">
          <Avatar
            name={
              isGroup
                ? conversation.name ?? t('common.groupFallback')
                : peer?.displayName ?? t('common.contactFallback')
            }
            avatarUrl={isGroup ? (editingGroup ? groupAvatar : conversation.avatarUrl) : peer?.avatarUrl}
            isGroup={isGroup}
            isOnline={peer?.isOnline}
            size="lg"
          />
          <div>
            <h3 className="text-lg font-semibold">
              {isGroup ? conversation.name : peer?.displayName}
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              {isGroup
                ? t('common.memberCount', { count: conversation.members.length })
                : `@${peer?.username}`}
            </p>
          </div>
          {(isGroup ? conversation.description : peer?.aboutBio) && !editingGroup && (
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {isGroup ? conversation.description : peer?.aboutBio}
            </p>
          )}
          {isGroup && isAdmin && !editingGroup && (
            <button
              type="button"
              onClick={() => setEditingGroup(true)}
              className="mt-1 px-3.5 py-1.5 rounded-full bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[var(--bg-hover)]"
            >
              <Pencil className="w-3.5 h-3.5 text-[var(--status-e2ee)]" aria-hidden="true" />
              <span>{t('infoDrawer.editGroupBtn')}</span>
            </button>
          )}
        </div>

        {isGroup && isAdmin && editingGroup && (
          <form
            onSubmit={(e) => void handleSaveGroupEdit(e)}
            className="p-4 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-subtle)] space-y-3"
          >
            <div className="flex items-center gap-2">
              <input
                ref={groupIconInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  setActionError(null);
                  pickFileForCrop(e);
                }}
                aria-label={t('infoDrawer.selectGroupIconAria')}
              />
              <button
                type="button"
                onClick={() => groupIconInputRef.current?.click()}
                className="px-3 py-1.5 rounded-full bg-[var(--bg-sidebar)] border border-[var(--border-subtle)] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[var(--bg-hover)]"
              >
                <Camera className="w-3.5 h-3.5 text-[var(--status-e2ee)]" aria-hidden="true" />
                <span>{groupAvatar ? t('infoDrawer.changeIcon') : t('infoDrawer.setIcon')}</span>
              </button>
              {groupAvatar && (
                <>
                  <button
                    type="button"
                    onClick={() => openExistingForCrop(groupAvatar)}
                    aria-label={t('infoDrawer.adjustIconAria')}
                    title={t('infoDrawer.adjustIconTitle')}
                    className="px-2.5 py-1.5 rounded-full bg-[var(--bg-sidebar)] border border-[var(--border-subtle)] text-xs font-medium inline-flex items-center gap-1 hover:bg-[var(--bg-hover)]"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--status-e2ee)]" aria-hidden="true" />
                    <span>{t('common.adjust')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupAvatar(null)}
                    aria-label={t('infoDrawer.removeIconAria')}
                    className="p-1.5 rounded-full border border-[var(--border-subtle)] text-[var(--status-danger)] hover:bg-[var(--bg-hover)]"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </>
              )}
            </div>

            <div>
              <label htmlFor="edit-group-name" className="block text-xs font-medium mb-1">
                {t('infoDrawer.groupNameLabel')}
              </label>
              <input
                id="edit-group-name"
                type="text"
                required
                maxLength={64}
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-xs"
              />
            </div>

            <div>
              <label htmlFor="edit-group-desc" className="block text-xs font-medium mb-1">
                {t('infoDrawer.groupDescLabel')}
              </label>
              <input
                id="edit-group-desc"
                type="text"
                maxLength={200}
                value={groupDesc}
                onChange={(e) => setGroupDesc(e.target.value)}
                placeholder={t('infoDrawer.groupDescPlaceholder')}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-xs"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setGroupName(conversation.name ?? '');
                  setGroupDesc(conversation.description ?? '');
                  setGroupAvatar(conversation.avatarUrl ?? null);
                  setEditingGroup(false);
                }}
                className="px-3 py-2 rounded-xl border border-[var(--border-subtle)] text-xs font-medium hover:bg-[var(--bg-hover)]"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={busyAction || !groupName.trim()}
                className="flex-1 py-2 px-3 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-fg)] text-xs font-semibold hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                {busyAction ? t('common.saving') : t('infoDrawer.saveInfo')}
              </button>
            </div>
          </form>
        )}

        <div className="p-4 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-subtle)] space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--status-e2ee)]">
            <Lock className="w-4 h-4" aria-hidden="true" />
            <span>{t('infoDrawer.e2eeTitle')}</span>
          </div>
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
            {isGroup
              ? t('infoDrawer.e2eeGroupDesc', { version: conversation.keyVersion })
              : t('infoDrawer.e2eeDirectDesc')}
          </p>
          {!isGroup && peer && (
            <button
              type="button"
              onClick={onOpenSafetyModal}
              className="w-full mt-1 py-2 px-3 rounded-xl bg-[var(--bg-sidebar)] border border-[var(--border-subtle)] text-xs font-medium flex items-center justify-center gap-2 hover:bg-[var(--bg-hover)]"
            >
              <Fingerprint className="w-4 h-4 text-[var(--status-e2ee)]" aria-hidden="true" />
              <span>{t('infoDrawer.viewSafetyNumber')}</span>
            </button>
          )}
        </div>

        <div>
          <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-2.5">
            {t('infoDrawer.sharedMediaTitle', { count: sharedMedia.length })}
          </h4>
          {sharedMedia.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)]">
              {t('infoDrawer.sharedMediaEmpty')}
            </p>
          ) : (
            <ul className="space-y-1.5 max-h-40 overflow-y-auto">
              {sharedMedia.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs"
                >
                  <FileText className="w-4 h-4 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
                  <span className="truncate flex-1">{m.decrypted?.media?.fileName}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {isGroup && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-[var(--text-secondary)]">
              {t('infoDrawer.membersTitle', { count: conversation.members.length })}
            </h4>

            {isAdmin && (
              <div className="space-y-2">
                <label htmlFor="drawer-add-member" className="sr-only">
                  {t('infoDrawer.inviteAria')}
                </label>
                <div className="relative">
                  <Search
                    className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
                    aria-hidden="true"
                  />
                  <input
                    id="drawer-add-member"
                    type="text"
                    value={memberQuery}
                    onChange={(e) => void handleSearchUser(e.target.value)}
                    placeholder={t('infoDrawer.invitePlaceholder')}
                    className="w-full pl-9 pr-3.5 py-2 rounded-full bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-xs"
                  />
                </div>
                {searchResults.length > 0 && (
                  <ul className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-app)] divide-y divide-[var(--border-subtle)] overflow-hidden">
                    {searchResults.map((candidate) => (
                      <li key={candidate.id}>
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={() => void handleAddMember(candidate)}
                          className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs hover:bg-[var(--bg-hover)]"
                        >
                          <span className="truncate font-medium">
                            {candidate.displayName} (@{candidate.username})
                          </span>
                          <UserPlus className="w-4 h-4 text-[var(--accent-primary)]" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <ul className="space-y-1.5">
              {conversation.members.map((member) => (
                <li
                  key={member.userId}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-subtle)]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar
                      name={member.displayName}
                      avatarUrl={member.avatarUrl}
                      isOnline={member.isOnline}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.userId === user.id
                          ? `${member.displayName}${t('common.youSuffix')}`
                          : member.displayName}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] truncate">
                        @{member.username} {member.role === 'admin' ? t('common.adminBadge') : ''}
                      </p>
                    </div>
                  </div>

                  {isAdmin && member.userId !== user.id && (
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={() => void handleRemoveOrLeave(member.userId)}
                      aria-label={t('infoDrawer.removeMemberAria', { name: member.displayName })}
                      title={t('infoDrawer.removeMemberTitle')}
                      className="p-2 rounded-full text-[var(--status-danger)] hover:bg-[var(--bg-hover)]"
                    >
                      <UserMinus className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {actionError && (
          <p role="alert" className="text-xs text-[var(--status-danger)]">
            {actionError}
          </p>
        )}

        <div className="pt-2 border-t border-[var(--border-subtle)]">
          {isGroup ? (
            <button
              type="button"
              disabled={busyAction}
              onClick={() => void handleRemoveOrLeave(user.id)}
              className="w-full py-2.5 px-4 rounded-xl border border-[var(--status-danger)] text-[var(--status-danger)] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[var(--bg-hover)]"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span>{t('infoDrawer.leaveGroup')}</span>
            </button>
          ) : (
            peer && (
              <button
                type="button"
                disabled={busyAction}
                onClick={() => void handleBlockToggle()}
                className="w-full py-2.5 px-4 rounded-xl border border-[var(--status-danger)] text-[var(--status-danger)] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[var(--bg-hover)]"
              >
                <Ban className="w-4 h-4" aria-hidden="true" />
                <span>
                  {isBlocked ? t('infoDrawer.unblockContact') : t('infoDrawer.blockContact')}
                </span>
              </button>
            )
          )}
        </div>
      </div>
      </aside>
      <AvatarCropModal
        imageSrc={cropImageSrc}
        title={t('infoDrawer.cropGroupIconTitle')}
        onCancel={closeCrop}
        onConfirm={confirmCrop}
      />
    </>
  );
};


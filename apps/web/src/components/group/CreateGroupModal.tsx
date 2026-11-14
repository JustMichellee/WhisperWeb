import { useEffect, useRef, useState, type FC, type FormEvent } from 'react';
import { AlertCircle, Camera, Check, Search, SlidersHorizontal, Trash2, Users, X } from 'lucide-react';
import type { UserPublicDto } from '@chat/shared';
import { apiClient } from '../../services/api';
import { useAuthStore } from '../../stores/useAuthStore';
import { useChatStore } from '../../stores/useChatStore';
import { useT } from '../../stores/useI18nStore';
import { useAvatarCropper } from '../../hooks/useAvatarCropper';
import { Avatar } from '../common/Avatar';
import { AvatarCropModal } from '../common/AvatarCropModal';
import { Modal } from '../common/Modal';

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
}

export const CreateGroupModal: FC<CreateGroupModalProps> = ({ open, onClose }) => {
  const { token, user, privateKey } = useAuthStore();
  const { createGroup } = useChatStore();
  const { t } = useT();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserPublicDto[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<UserPublicDto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !token) return;
    const cleaned = query.trim().replace(/^@/, '');
    if (cleaned.length < 2) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(() => {
      setSearching(true);
      void apiClient
        .searchUsers(token, cleaned)
        .then((res) => setResults(res.users))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [open, query, token]);

  const { cropImageSrc, pickFileForCrop, openExistingForCrop, closeCrop, confirmCrop } =
    useAvatarCropper({
      onApply: setAvatarUrl,
      onError: setError,
    });

  useEffect(() => {
    if (!open) {
      closeCrop();
    }
  }, [open, closeCrop]);

  const toggleMember = (candidate: UserPublicDto) => {
    setSelected((prev) =>
      prev.some((m) => m.id === candidate.id)
        ? prev.filter((m) => m.id !== candidate.id)
        : [...prev, candidate]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !user || !privateKey) return;
    if (selected.length === 0) {
      setError(t('createGroup.minMemberError'));
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await createGroup(name.trim(), description.trim(), selected, token, user, privateKey, avatarUrl);
      setName('');
      setDescription('');
      setAvatarUrl(null);
      setQuery('');
      setSelected([]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('createGroup.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal open={open} title={t('createGroup.modalTitle')} onClose={onClose}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-3.5">
            <Avatar
              name={name || t('common.groupFallback')}
              avatarUrl={avatarUrl}
              isGroup={true}
              size="lg"
            />
            <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
              <input
                ref={iconInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  setError(null);
                  pickFileForCrop(e);
                }}
                aria-label={t('createGroup.selectIconAria')}
              />
              <button
                type="button"
                onClick={() => iconInputRef.current?.click()}
                className="px-3 py-1.5 rounded-full bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap hover:bg-[var(--bg-hover)]"
              >
                <Camera className="w-3.5 h-3.5 text-[var(--status-e2ee)] shrink-0" aria-hidden="true" />
                <span>{avatarUrl ? t('createGroup.changeIcon') : t('createGroup.chooseIcon')}</span>
              </button>
              {avatarUrl && (
                <>
                  <button
                    type="button"
                    onClick={() => openExistingForCrop(avatarUrl)}
                    aria-label={t('createGroup.adjustIconAria')}
                    title={t('createGroup.adjustIconTitle')}
                    className="px-2.5 py-1.5 rounded-full bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs font-medium inline-flex items-center gap-1 whitespace-nowrap hover:bg-[var(--bg-hover)]"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--status-e2ee)] shrink-0" aria-hidden="true" />
                    <span>{t('common.adjust')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(null)}
                    aria-label={t('createGroup.removeIconAria')}
                    className="p-2 rounded-full border border-[var(--border-subtle)] text-[var(--status-danger)] hover:bg-[var(--bg-hover)]"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          </div>
        <div>
          <label htmlFor="group-name" className="block text-sm font-medium mb-1.5">
            {t('createGroup.nameLabel')}
          </label>
          <input
            id="group-name"
            type="text"
            required
            maxLength={64}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('createGroup.namePlaceholder')}
            className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-sm"
          />
        </div>

        <div>
          <label htmlFor="group-desc" className="block text-sm font-medium mb-1.5">
            {t('createGroup.descLabel')}
          </label>
          <input
            id="group-desc"
            type="text"
            maxLength={200}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('createGroup.descPlaceholder')}
            className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-sm"
          />
        </div>

        <div>
          <label htmlFor="group-member-search" className="block text-sm font-medium mb-1.5">
            {t('createGroup.inviteLabel')}
          </label>
          <div className="relative">
            <Search
              className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
              aria-hidden="true"
            />
            <input
              id="group-member-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('createGroup.invitePlaceholder')}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-sm"
            />
          </div>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((member) => (
              <span
                key={member.id}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs font-medium"
              >
                <span>@{member.username}</span>
                <button
                  type="button"
                  onClick={() => toggleMember(member)}
                  aria-label={t('createGroup.removeMemberAria', { name: member.displayName })}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="max-h-44 overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-app)]">
          {searching ? (
            <p className="p-3.5 text-xs text-[var(--text-secondary)]">{t('createGroup.searching')}</p>
          ) : query.trim().length < 2 ? (
            <p className="p-3.5 text-xs text-[var(--text-secondary)]">
              {t('createGroup.searchPrompt')}
            </p>
          ) : results.length === 0 ? (
            <p className="p-3.5 text-xs text-[var(--text-secondary)]">{t('createGroup.noResults')}</p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {results.map((item) => {
                const isPicked = selected.some((s) => s.id === item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggleMember(item)}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-[var(--bg-hover)]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar name={item.displayName} avatarUrl={item.avatarUrl} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.displayName}</p>
                          <p className="text-xs text-[var(--text-secondary)] truncate">
                            @{item.username}
                          </p>
                        </div>
                      </div>
                      {isPicked && (
                        <Check className="w-4 h-4 text-[var(--status-e2ee)] shrink-0" aria-hidden="true" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
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
          disabled={submitting || selected.length === 0 || !name.trim()}
          className="w-full py-2.5 px-4 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-fg)] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          <Users className="w-4 h-4" aria-hidden="true" />
          <span>{submitting ? t('createGroup.creatingKeys') : t('createGroup.submitCreate')}</span>
        </button>
        </form>
      </Modal>
      <AvatarCropModal
        imageSrc={cropImageSrc}
        title={t('createGroup.cropTitle')}
        onCancel={closeCrop}
        onConfirm={confirmCrop}
      />
    </>
  );
};


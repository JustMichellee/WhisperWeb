import { useEffect, useRef, useState, type FC, type FormEvent } from 'react';
import { AlertCircle, Camera, CheckCircle2, KeyRound, Shield, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useT } from '../../stores/useI18nStore';
import { useAvatarCropper } from '../../hooks/useAvatarCropper';
import { Avatar } from '../common/Avatar';
import { AvatarCropModal } from '../common/AvatarCropModal';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { Modal } from '../common/Modal';

interface ProfileSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export const ProfileSettingsModal: FC<ProfileSettingsModalProps> = ({ open, onClose }) => {
  const { user, passkeyCount, updateProfile, registerPasskey } = useAuthStore();
  const { t } = useT();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [aboutBio, setAboutBio] = useState(user?.aboutBio ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [hideOnline, setHideOnline] = useState(user?.hideOnlineStatus ?? false);
  const [saving, setSaving] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const { cropImageSrc, pickFileForCrop, openExistingForCrop, closeCrop, confirmCrop } =
    useAvatarCropper({
      onApply: setAvatarUrl,
      onError: (text) => setFeedback({ type: 'err', text }),
    });

  useEffect(() => {
    if (!open) {
      closeCrop();
      return;
    }
    if (!user) return;
    setDisplayName(user.displayName);
    setAboutBio(user.aboutBio);
    setAvatarUrl(user.avatarUrl);
    setHideOnline(user.hideOnlineStatus);
    setFeedback(null);
  }, [open, user, closeCrop]);

  if (!user) return null;

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim(),
        aboutBio: aboutBio.trim(),
        avatarUrl,
        hideOnlineStatus: hideOnline,
      });
      setFeedback({ type: 'ok', text: t('settings.profileSaved') });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : t('settings.profileError'),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddPasskey = async () => {
    setFeedback(null);
    setPasskeyLoading(true);
    try {
      await registerPasskey();
      setFeedback({ type: 'ok', text: t('settings.passkeyLinked') });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : t('settings.passkeyError'),
      });
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <>
      <Modal open={open} title={t('settings.modalTitle')} onClose={onClose}>
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3.5 pb-4 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-3.5 min-w-0">
              <Avatar name={displayName || user.displayName} avatarUrl={avatarUrl} size="lg" />
              <div className="min-w-0">
                <p className="text-base font-semibold truncate">{displayName || user.displayName}</p>
                <p className="text-sm text-[var(--text-secondary)] font-mono-code">@{user.username}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  setFeedback(null);
                  pickFileForCrop(e);
                }}
                aria-label={t('settings.selectAvatarAria')}
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="px-3 py-1.5 rounded-full bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs font-medium flex items-center gap-1.5 hover:bg-[var(--bg-hover)]"
              >
                <Camera className="w-3.5 h-3.5 text-[var(--status-e2ee)]" aria-hidden="true" />
                <span>{t('settings.changePhoto')}</span>
              </button>
              {avatarUrl && (
                <>
                  <button
                    type="button"
                    onClick={() => openExistingForCrop(avatarUrl)}
                    aria-label={t('settings.adjustPhotoAria')}
                    title={t('settings.adjustPhotoTitle')}
                    className="px-2.5 py-1.5 rounded-full bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs font-medium flex items-center gap-1 hover:bg-[var(--bg-hover)]"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--status-e2ee)]" aria-hidden="true" />
                    <span>{t('common.adjust')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(null)}
                    aria-label={t('settings.removePhotoAria')}
                    title={t('settings.removePhotoAria')}
                    className="p-2 rounded-full border border-[var(--border-subtle)] text-[var(--status-danger)] hover:bg-[var(--bg-hover)]"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="profile-displayname" className="block text-sm font-medium mb-1.5">
              {t('settings.displayNameLabel')}
            </label>
            <input
              id="profile-displayname"
              type="text"
              required
              maxLength={48}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-sm"
            />
          </div>

          <div>
            <label htmlFor="profile-bio" className="block text-sm font-medium mb-1.5">
              {t('settings.bioLabel')}
            </label>
            <input
              id="profile-bio"
              type="text"
              maxLength={140}
              value={aboutBio}
              onChange={(e) => setAboutBio(e.target.value)}
              placeholder={t('settings.bioPlaceholder')}
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-sm"
            />
          </div>

          <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-subtle)]">
            <div className="min-w-0">
              <span className="block text-sm font-medium">{t('settings.languageTitle')}</span>
              <span className="block text-xs text-[var(--text-secondary)]">
                {t('settings.languageDesc')}
              </span>
            </div>
            <LanguageSwitcher />
          </div>

          <label className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-subtle)]">
            <div>
              <span className="block text-sm font-medium">{t('settings.hideOnlineTitle')}</span>
              <span className="block text-xs text-[var(--text-secondary)]">
                {t('settings.hideOnlineDesc')}
              </span>
            </div>
            <input
              type="checkbox"
              checked={hideOnline}
              onChange={(e) => setHideOnline(e.target.checked)}
              className="w-4 h-4 accent-[var(--accent-primary)]"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 px-4 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-fg)] font-semibold text-sm hover:bg-[var(--accent-hover)] disabled:opacity-60"
          >
            {saving ? t('common.saving') : t('settings.saveChanges')}
          </button>
        </form>

        <div className="pt-4 border-t border-[var(--border-subtle)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--status-e2ee)]" aria-hidden="true" />
              <span className="text-sm font-semibold">{t('settings.passkeyTitle')}</span>
            </div>
            <span className="text-xs tabular-nums text-[var(--text-secondary)]">
              {t('settings.passkeyCount', { count: passkeyCount })}
            </span>
          </div>

          <button
            type="button"
            disabled={passkeyLoading}
            onClick={() => void handleAddPasskey()}
            className="w-full py-2.5 px-4 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[var(--bg-hover)] disabled:opacity-60"
          >
            <KeyRound className="w-4 h-4" aria-hidden="true" />
            <span>{passkeyLoading ? t('settings.connectingDevice') : t('settings.addPasskey')}</span>
          </button>
        </div>

        {feedback && (
          <div
            role={feedback.type === 'err' ? 'alert' : 'status'}
            className={`flex items-start gap-2 p-3 rounded-xl border text-sm ${
              feedback.type === 'err'
                ? 'border-[var(--status-danger)] text-[var(--status-danger)]'
                : 'border-[var(--status-e2ee)] text-[var(--status-e2ee)]'
            }`}
          >
            {feedback.type === 'err' ? (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}
        </div>
      </Modal>
      <AvatarCropModal
        imageSrc={cropImageSrc}
        title={t('settings.cropAvatarTitle')}
        onCancel={closeCrop}
        onConfirm={confirmCrop}
      />
    </>
  );
};


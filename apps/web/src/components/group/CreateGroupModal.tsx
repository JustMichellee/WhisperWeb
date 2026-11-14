import { useEffect, useRef, useState, type FC, type FormEvent } from 'react';
import { AlertCircle, Camera, Check, Search, SlidersHorizontal, Trash2, Users, X } from 'lucide-react';
import type { UserPublicDto } from '@chat/shared';
import { apiClient } from '../../services/api';
import { useAuthStore } from '../../stores/useAuthStore';
import { useChatStore } from '../../stores/useChatStore';
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
      setError('Pilih minimal 1 anggota lain untuk membuat grup.');
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
      setError(err instanceof Error ? err.message : 'Gagal membuat grup terenkripsi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal open={open} title="Buat Grup Terenkripsi Baru" onClose={onClose}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-3.5">
            <Avatar name={name || 'Grup'} avatarUrl={avatarUrl} isGroup={true} size="lg" />
            <div className="flex items-center gap-2">
              <input
                ref={iconInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  setError(null);
                  pickFileForCrop(e);
                }}
                aria-label="Pilih ikon grup"
              />
              <button
                type="button"
                onClick={() => iconInputRef.current?.click()}
                className="px-3 py-1.5 rounded-full bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs font-medium flex items-center gap-1.5 hover:bg-[var(--bg-hover)]"
              >
                <Camera className="w-3.5 h-3.5 text-[var(--status-e2ee)]" aria-hidden="true" />
                <span>{avatarUrl ? 'Ganti Ikon' : 'Pilih Ikon Grup'}</span>
              </button>
              {avatarUrl && (
                <>
                  <button
                    type="button"
                    onClick={() => openExistingForCrop(avatarUrl)}
                    aria-label="Atur posisi dan ukuran ikon grup"
                    title="Atur posisi ikon"
                    className="px-2.5 py-1.5 rounded-full bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs font-medium flex items-center gap-1 hover:bg-[var(--bg-hover)]"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--status-e2ee)]" aria-hidden="true" />
                    <span>Atur</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(null)}
                    aria-label="Hapus ikon grup"
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
            Nama Grup
          </label>
          <input
            id="group-name"
            type="text"
            required
            maxLength={64}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Misal: Nongkrong Akhir Pekan"
            className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-sm"
          />
        </div>

        <div>
          <label htmlFor="group-desc" className="block text-sm font-medium mb-1.5">
            Deskripsi Grup (Opsional)
          </label>
          <input
            id="group-desc"
            type="text"
            maxLength={200}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Catatan singkat grup"
            className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-sm"
          />
        </div>

        <div>
          <label htmlFor="group-member-search" className="block text-sm font-medium mb-1.5">
            Undang Teman (@username)
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
              placeholder="Ketik minimal 2 huruf username..."
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
                  aria-label={`Hapus ${member.displayName} dari daftar`}
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
            <p className="p-3.5 text-xs text-[var(--text-secondary)]">Mencari pengguna...</p>
          ) : query.trim().length < 2 ? (
            <p className="p-3.5 text-xs text-[var(--text-secondary)]">
              Cari username teman yang ingin diajak ke grup.
            </p>
          ) : results.length === 0 ? (
            <p className="p-3.5 text-xs text-[var(--text-secondary)]">Tidak ada pengguna ditemukan.</p>
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
          <span>{submitting ? 'Membuat Kunci Grup...' : 'Buat Grup Terenkripsi'}</span>
        </button>
        </form>
      </Modal>
      <AvatarCropModal
        imageSrc={cropImageSrc}
        title="Atur Ikon Grup"
        onCancel={closeCrop}
        onConfirm={confirmCrop}
      />
    </>
  );
};


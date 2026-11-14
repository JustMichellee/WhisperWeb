import { useState, type FC } from 'react';
import { Check, Copy, Download, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { Modal } from '../common/Modal';

export const RecoveryKeyModal: FC = () => {
  const { pendingRecoveryCode, user, clearPendingRecoveryCode } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  if (!pendingRecoveryCode || !user) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(pendingRecoveryCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    const content = [
      'WhisperWeb Recovery Key (RAHASIA)',
      `Username: @${user.username}`,
      `Recovery Key: ${pendingRecoveryCode}`,
      '',
      'Simpan kode ini di tempat aman. Anda membutuhkannya untuk memulihkan akun dan mendekripsi riwayat chat jika lupa password.',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `whisperweb-recovery-${user.username}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      open={true}
      title="Simpan Recovery Key Anda"
      onClose={clearPendingRecoveryCode}
      disableClose={true}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[var(--bg-app)] border border-[var(--status-warning)] text-sm">
          <ShieldAlert className="w-5 h-5 shrink-0 text-[var(--status-warning)] mt-0.5" aria-hidden="true" />
          <p className="text-[var(--text-primary)]">
            Karena WhisperWeb tidak menyimpan email, nomor HP, maupun password asli Anda, kode ini
            adalah satu-satunya cara memulihkan akun jika lupa password.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-center">
          <p className="text-xs text-[var(--text-secondary)] mb-1.5">
            Recovery Key untuk @{user.username}
          </p>
          <p className="font-mono-code text-base font-semibold tracking-wider select-all break-all text-[var(--status-e2ee)]">
            {pendingRecoveryCode}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="py-2.5 px-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[var(--bg-hover)]"
          >
            {copied ? (
              <Check className="w-4 h-4 text-[var(--status-e2ee)]" aria-hidden="true" />
            ) : (
              <Copy className="w-4 h-4" aria-hidden="true" />
            )}
            <span>{copied ? 'Tersalin' : 'Salin Kode'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="py-2.5 px-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[var(--bg-hover)]"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>Unduh (.txt)</span>
          </button>
        </div>

        <label className="flex items-start gap-2.5 text-sm text-[var(--text-primary)] pt-1">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-1 w-4 h-4 accent-[var(--accent-primary)]"
          />
          <span>Saya sudah menyalin atau mengunduh Recovery Key ini ke tempat yang aman.</span>
        </label>

        <button
          type="button"
          disabled={!confirmed}
          onClick={clearPendingRecoveryCode}
          className="w-full py-2.5 px-4 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-fg)] font-semibold text-sm hover:bg-[var(--accent-hover)] disabled:opacity-45"
        >
          Lanjut ke Ruang Chat
        </button>
      </div>
    </Modal>
  );
};


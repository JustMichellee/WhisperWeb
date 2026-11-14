import { useEffect, useState, type FC } from 'react';
import { Check, Copy, ShieldCheck } from 'lucide-react';
import { computeSafetyNumber } from '../../crypto/keys';
import { Modal } from '../common/Modal';

interface SafetyNumberModalProps {
  open: boolean;
  onClose: () => void;
  myPublicKey: string;
  peerPublicKey: string;
  peerName: string;
  peerUsername: string;
}

export const SafetyNumberModal: FC<SafetyNumberModalProps> = ({
  open,
  onClose,
  myPublicKey,
  peerPublicKey,
  peerName,
  peerUsername,
}) => {
  const [blocks, setBlocks] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    void computeSafetyNumber(myPublicKey, peerPublicKey).then(setBlocks);
  }, [open, myPublicKey, peerPublicKey]);

  const joined = blocks.join(' ');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(joined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal open={open} title="Verifikasi Keamanan End-to-End" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-subtle)]">
          <ShieldCheck className="w-5 h-5 shrink-0 text-[var(--status-e2ee)] mt-0.5" aria-hidden="true" />
          <p className="text-sm text-[var(--text-primary)]">
            Percakapan dengan <span className="font-semibold">{peerName}</span> (@{peerUsername})
            dienkripsi secara end-to-end antara perangkat kalian.
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">
            Safety Number (60 Digit)
          </p>
          <div className="grid grid-cols-4 gap-2.5 p-4 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-subtle)] font-mono-code tabular-nums text-sm text-center">
            {blocks.map((block, index) => (
              <span key={index} className="tracking-wider font-semibold text-[var(--text-primary)]">
                {block}
              </span>
            ))}
          </div>
        </div>

        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
          Cocokkan 60 digit angka di atas dengan angka yang tampil di layar {peerName}. Jika sama
          persis, kunci percakapan kalian terjamin aman.
        </p>

        <button
          type="button"
          onClick={() => void handleCopy()}
          className="w-full py-2.5 px-4 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[var(--bg-hover)]"
        >
          {copied ? (
            <Check className="w-4 h-4 text-[var(--status-e2ee)]" aria-hidden="true" />
          ) : (
            <Copy className="w-4 h-4" aria-hidden="true" />
          )}
          <span>{copied ? 'Safety Number Tersalin' : 'Salin Safety Number'}</span>
        </button>
      </div>
    </Modal>
  );
};


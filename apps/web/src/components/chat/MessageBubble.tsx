import { useEffect, useState, type FC } from 'react';
import {
  Check,
  CheckCheck,
  Clock,
  Download,
  FileText,
  Lock,
  Reply,
  SmilePlus,
  Trash2,
} from 'lucide-react';
import { decryptBinaryFile } from '../../crypto/cipher';
import { apiClient } from '../../services/api';
import { useAuthStore } from '../../stores/useAuthStore';
import type { UiMessage } from '../../stores/useChatStore';
import { formatMessageText } from '../../utils/formatMessageText';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface MessageBubbleProps {
  message: UiMessage;
  isMine: boolean;
  isFirstInGroup: boolean;
  showSenderName: boolean;
  senderName: string;
  otherMemberCount: number;
  onReply: (msg: UiMessage) => void;
  onJumpToMessage: (messageId: string) => void;
  onReact: (messageId: string, emoji: string | null) => void;
  onDelete: (messageId: string, mode: 'everyone' | 'me') => void;
  onPreviewImage: (src: string, fileName: string) => void;
}

export const MessageBubble: FC<MessageBubbleProps> = ({
  message,
  isMine,
  isFirstInGroup,
  showSenderName,
  senderName,
  otherMemberCount,
  onReply,
  onJumpToMessage,
  onReact,
  onDelete,
  onPreviewImage,
}) => {
  const { token, user } = useAuthStore();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [downloadingDoc, setDownloadingDoc] = useState(false);
  const [showReactBar, setShowReactBar] = useState(false);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);

  const media = message.decrypted?.media;
  const isImage = message.messageType === 'image' && Boolean(media);

  useEffect(() => {
    if (!isImage || !media || !token || message.isDeleted) return;
    let active = true;
    let createdUrl: string | null = null;

    setMediaLoading(true);
    setMediaError(null);

    void apiClient
      .downloadEncryptedBlob(token, media.attachmentId)
      .then((encryptedBuffer) =>
        decryptBinaryFile(encryptedBuffer, media.fileKeyBase64, media.fileIvBase64)
      )
      .then((plainBuffer) => {
        if (!active) return;
        const blob = new Blob([plainBuffer], { type: media.mimeType });
        createdUrl = URL.createObjectURL(blob);
        setImageUrl(createdUrl);
      })
      .catch(() => {
        if (active) setMediaError('Gagal mendekripsi gambar.');
      })
      .finally(() => {
        if (active) setMediaLoading(false);
      });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [isImage, media, token, message.isDeleted]);

  const handleDownloadDocument = async () => {
    if (!media || !token || downloadingDoc) return;
    setDownloadingDoc(true);
    setMediaError(null);
    try {
      const encrypted = await apiClient.downloadEncryptedBlob(token, media.attachmentId);
      const plain = await decryptBinaryFile(encrypted, media.fileKeyBase64, media.fileIvBase64);
      const blob = new Blob([plain], { type: media.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = media.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMediaError('Gagal mengunduh atau mendekripsi berkas.');
    } finally {
      setDownloadingDoc(false);
    }
  };

  const renderReceiptIcon = () => {
    if (!isMine) return null;
    if (message.localStatus === 'pending') {
      return <Clock className="w-3.5 h-3.5 text-[var(--text-bubble-out-meta)]" aria-label="Mengirim" />;
    }

    const othersReceipts = message.receipts.filter((r) => r.userId !== user?.id);
    const allRead =
      otherMemberCount > 0 &&
      othersReceipts.filter((r) => r.readAt !== null).length >= otherMemberCount;
    const anyRead = othersReceipts.some((r) => r.readAt !== null);
    const anyDelivered = othersReceipts.some((r) => r.deliveredAt !== null);

    if (allRead || (otherMemberCount === 1 && anyRead)) {
      return (
        <CheckCheck
          className="w-4 h-4 text-[var(--read-receipt)]"
          aria-label="Dibaca"
        />
      );
    }
    if (anyDelivered) {
      return (
        <CheckCheck
          className="w-4 h-4 text-[var(--text-bubble-out-meta)]"
          aria-label="Diterima perangkat"
        />
      );
    }
    return (
      <Check
        className="w-3.5 h-3.5 text-[var(--text-bubble-out-meta)]"
        aria-label="Terkirim ke server"
      />
    );
  };

  // Group reactions by emoji for compact display
  const groupedReactions = message.reactions.reduce<Record<string, { count: number; mine: boolean }>>(
    (acc, item) => {
      const prev = acc[item.emoji] ?? { count: 0, mine: false };
      acc[item.emoji] = {
        count: prev.count + 1,
        mine: prev.mine || item.userId === user?.id,
      };
      return acc;
    },
    {}
  );

  const metaColorClass = isMine
    ? 'text-[var(--text-bubble-out-meta)]'
    : 'text-[var(--text-secondary)]';

  const cornerClass = isMine
    ? isFirstInGroup
      ? 'rounded-2xl rounded-tr-sm'
      : 'rounded-2xl'
    : isFirstInGroup
      ? 'rounded-2xl rounded-tl-sm'
      : 'rounded-2xl';

  return (
    <div
      id={`message-${message.id}`}
      className={`group flex flex-col ${isMine ? 'items-end' : 'items-start'} ${
        isFirstInGroup ? 'mt-3' : 'mt-1'
      }`}
    >
      <div className={`flex items-end gap-1.5 max-w-[85%] md:max-w-[65%] ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
        <div
          className={`relative px-4 py-2.5 shadow-sm ${cornerClass} ${
            isMine
              ? 'bg-[var(--bubble-out)] text-[var(--text-primary)]'
              : 'bg-[var(--bubble-in)] text-[var(--text-primary)]'
          }`}
        >
          {showSenderName && !isMine && isFirstInGroup && (
            <p className="text-xs font-semibold text-[var(--status-e2ee)] mb-1">
              {senderName}
            </p>
          )}

          {message.isDeleted ? (
            <p className={`text-sm italic ${metaColorClass}`}>Pesan ini telah dihapus</p>
          ) : message.decryptError || !message.decrypted ? (
            <div className="flex items-center gap-2 text-sm italic text-[var(--status-warning)]">
              <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Pesan terenkripsi tidak dapat didekripsi dengan kunci saat ini.</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {message.decrypted.replyToPreview && (
                <button
                  type="button"
                  onClick={() => onJumpToMessage(message.decrypted!.replyToPreview!.id)}
                  className={`w-full text-left px-3 py-1.5 rounded-xl border-l-[3px] border-[var(--status-e2ee)] ${
                    isMine ? 'bg-[var(--reply-out-bg)]' : 'bg-[var(--reply-in-bg)]'
                  }`}
                >
                  <p className="text-xs font-semibold text-[var(--status-e2ee)] truncate">
                    {message.decrypted.replyToPreview.senderName}
                  </p>
                  <p className={`text-xs truncate ${metaColorClass}`}>
                    {message.decrypted.replyToPreview.snippet}
                  </p>
                </button>
              )}

              {isImage && media && (
                <div className="overflow-hidden rounded-xl">
                  {mediaLoading && (
                    <div className="w-56 h-40 rounded-xl border border-[var(--border-subtle)] flex flex-col items-center justify-center gap-1.5 text-xs">
                      <Lock className="w-4 h-4" aria-hidden="true" />
                      <span>Membuka foto...</span>
                    </div>
                  )}
                  {mediaError && (
                    <p className="text-xs text-[var(--status-danger)] py-2">{mediaError}</p>
                  )}
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => onPreviewImage(imageUrl, media.fileName)}
                      aria-label={`Perbesar gambar ${media.fileName}`}
                      className="block rounded-xl overflow-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                    >
                      <img
                        src={imageUrl}
                        alt={media.fileName}
                        className="max-h-72 w-auto max-w-full object-cover rounded-xl"
                      />
                    </button>
                  )}
                </div>
              )}

              {message.messageType === 'file' && media && (
                <div
                  className={`flex items-center gap-3 p-2.5 rounded-xl min-w-[210px] ${
                    isMine ? 'bg-[var(--reply-out-bg)]' : 'bg-[var(--reply-in-bg)]'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-[var(--bg-sidebar)] flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-[var(--status-e2ee)]" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{media.fileName}</p>
                    <p className={`text-xs tabular-nums ${metaColorClass}`}>
                      {formatBytes(media.sizeBytes)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={downloadingDoc}
                    onClick={() => void handleDownloadDocument()}
                    aria-label={`Unduh dan dekripsi ${media.fileName}`}
                    className="p-2 rounded-full hover:bg-[var(--bg-hover)] shrink-0"
                  >
                    <Download className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              )}

              {message.decrypted.text && (
                <p className="text-[14.5px] leading-[1.45] whitespace-pre-wrap break-words">
                  {formatMessageText(message.decrypted.text)}
                </p>
              )}
            </div>
          )}

          <div className={`mt-1 flex items-center justify-end gap-1 text-[11px] tabular-nums ${metaColorClass}`}>
            <span>{formatTime(message.createdAt)}</span>
            {renderReceiptIcon()}
          </div>
        </div>

        {!message.isDeleted && (
          <div className="relative flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onReply(message)}
              aria-label="Balas pesan ini"
              title="Balas"
              className="p-1.5 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            >
              <Reply className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => {
                setShowReactBar((prev) => !prev);
                setShowDeleteMenu(false);
              }}
              aria-label="Beri reaksi emoji"
              title="Reaksi"
              className="p-1.5 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            >
              <SmilePlus className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => {
                setShowDeleteMenu((prev) => !prev);
                setShowReactBar(false);
              }}
              aria-label="Opsi hapus pesan"
              title="Hapus"
              className="p-1.5 rounded-full text-[var(--text-secondary)] hover:text-[var(--status-danger)] hover:bg-[var(--bg-hover)]"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>

            {showReactBar && (
              <div
                className={`absolute bottom-9 z-20 flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--bg-sidebar)] border border-[var(--border-subtle)] shadow-lg ${
                  isMine ? 'right-0' : 'left-0'
                }`}
              >
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      const alreadyMine = message.reactions.some(
                        (r) => r.userId === user?.id && r.emoji === emoji
                      );
                      onReact(message.id, alreadyMine ? null : emoji);
                      setShowReactBar(false);
                    }}
                    className="w-8 h-8 rounded-full hover:bg-[var(--bg-hover)] text-base flex items-center justify-center"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {showDeleteMenu && (
              <div
                className={`absolute bottom-9 z-20 w-44 py-1.5 rounded-2xl bg-[var(--bg-sidebar)] border border-[var(--border-subtle)] shadow-lg text-xs ${
                  isMine ? 'right-0' : 'left-0'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onDelete(message.id, 'me');
                    setShowDeleteMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
                >
                  Hapus untuk saya
                </button>
                {isMine && (
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(message.id, 'everyone');
                      setShowDeleteMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[var(--bg-hover)] text-[var(--status-danger)]"
                  >
                    Hapus untuk semua orang
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {Object.keys(groupedReactions).length > 0 && !message.isDeleted && (
        <div className="flex flex-wrap gap-1 mt-1 px-1">
          {Object.entries(groupedReactions).map(([emoji, info]) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onReact(message.id, info.mine ? null : emoji)}
              className={`px-2.5 py-0.5 rounded-full text-xs tabular-nums border flex items-center gap-1 ${
                info.mine
                  ? 'bg-[var(--bg-active)] border-[var(--status-e2ee)] text-[var(--text-primary)]'
                  : 'bg-[var(--bg-sidebar)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
              }`}
            >
              <span>{emoji}</span>
              <span>{info.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};


import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FC,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
  Lock,
  Paperclip,
  Search,
  SendHorizontal,
  ShieldCheck,
  Smile,
  Users,
  X,
} from 'lucide-react';
import { MAX_ATTACHMENT_BYTES } from '@chat/shared';
import { useAuthStore } from '../../stores/useAuthStore';
import { useChatStore, type UiConversation } from '../../stores/useChatStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { Avatar } from '../common/Avatar';
import { MessageBubble } from './MessageBubble';

const COMPOSER_EMOJIS = ['😀', '😂', '🥰', '👍', '🙏', '🔥', '🎉', '✅', '❤️', '😮', '😢', '🤝'];

interface ChatCanvasProps {
  conversation: UiConversation | null;
  onBackMobile: () => void;
  onCloseConversation: () => void;
  onPrevConversation: () => void;
  onNextConversation: () => void;
  hasPrevConversation: boolean;
  hasNextConversation: boolean;
  onFocusSearch: () => void;
  onOpenNewGroup: () => void;
  onToggleInfo: () => void;
  onOpenSafetyModal: () => void;
  onPreviewImage: (src: string, fileName: string) => void;
}

function formatDateHeading(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (date.toDateString() === now.toDateString()) return 'Hari Ini';
  if (date.toDateString() === yesterday.toDateString()) return 'Kemarin';
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatLastSeen(ts: number | null): string {
  if (!ts) return 'offline';
  const date = new Date(ts);
  return `terakhir dilihat ${date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export const ChatCanvas: FC<ChatCanvasProps> = ({
  conversation,
  onBackMobile,
  onCloseConversation,
  onPrevConversation,
  onNextConversation,
  hasPrevConversation,
  hasNextConversation,
  onFocusSearch,
  onOpenNewGroup,
  onToggleInfo,
  onOpenSafetyModal,
  onPreviewImage,
}) => {
  const { user, token, privateKey } = useAuthStore();
  const { theme } = useThemeStore();
  const {
    messagesByConv,
    messagesLoading,
    messagesError,
    typingByConv,
    replyTarget,
    blockedUserIds,
    setReplyTarget,
    sendTextMessage,
    sendFileMessage,
    sendTyping,
    toggleReaction,
    deleteMessage,
    selectConversation,
  } = useChatStore();

  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showInChatSearch, setShowInChatSearch] = useState(false);
  const [inChatQuery, setInChatQuery] = useState('');

  const streamEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<number | null>(null);

  const convId = conversation?.id ?? '';
  const messages = convId ? messagesByConv[convId] ?? [] : [];
  const isLoadingMsgs = convId ? Boolean(messagesLoading[convId]) : false;
  const msgsError = convId ? messagesError[convId] : null;

  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [convId, messages.length]);

  useEffect(() => {
    setSelectedFile(null);
    setSendError(null);
    setShowInChatSearch(false);
    setInChatQuery('');
  }, [convId]);

  if (!user || !token || !privateKey) return null;

  if (!conversation) {
    return (
      <main className="hidden md:flex flex-1 flex-col items-center justify-center p-8 chat-canvas-surface md:rounded-2xl md:border md:border-[var(--border-subtle)] shadow-sm overflow-hidden">
        <div className="max-w-md flex flex-col items-center text-center gap-4">
          <img
            src={theme === 'dark' ? '/empty-state.svg' : '/empty-state-light.svg'}
            alt="Belum ada obrolan dipilih"
            className="w-40 h-40 select-none"
          />
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">
              Ruang obrolan masih kosong
            </h1>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
              Pilih percakapan di daftar sebelah kiri atau mulai ruang baru yang terenkripsi
              end-to-end.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={onFocusSearch}
              className="h-9 px-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] hover:bg-[var(--bg-hover)] text-xs font-medium text-[var(--text-primary)] inline-flex items-center gap-2 transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-[var(--status-e2ee)]" aria-hidden="true" />
              <span>Cari @username</span>
            </button>
            <button
              type="button"
              onClick={onOpenNewGroup}
              className="h-9 px-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] hover:bg-[var(--bg-hover)] text-xs font-medium text-[var(--text-primary)] inline-flex items-center gap-2 transition-colors"
            >
              <Users className="w-3.5 h-3.5 text-[var(--status-e2ee)]" aria-hidden="true" />
              <span>Buat Grup Baru</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  const isGroup = conversation.type === 'group';
  const peer = !isGroup ? conversation.members.find((m) => m.userId !== user.id) : null;
  const isBlocked = peer ? blockedUserIds.includes(peer.userId) : false;
  const typingIds = (typingByConv[conversation.id] ?? []).filter((id) => id !== user.id);

  const headerTitle = isGroup ? conversation.name ?? 'Grup' : peer?.displayName ?? 'Kontak';
  let statusLine = '';
  if (typingIds.length > 0) {
    if (isGroup) {
      const typer = conversation.members.find((m) => m.userId === typingIds[0]);
      statusLine = `${typer?.displayName ?? 'Seseorang'} sedang mengetik...`;
    } else {
      statusLine = 'sedang mengetik...';
    }
  } else if (isGroup) {
    statusLine = `${conversation.members.length} anggota grup`;
  } else if (peer?.isOnline) {
    statusLine = 'online';
  } else {
    statusLine = formatLastSeen(peer?.lastSeenAt ?? null);
  }

  const visibleMessages = inChatQuery.trim()
    ? messages.filter((m) =>
        (m.decrypted?.text ?? m.decrypted?.media?.fileName ?? '')
          .toLowerCase()
          .includes(inChatQuery.trim().toLowerCase())
      )
    : messages;

  const handleTextChange = (value: string) => {
    setText(value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }

    sendTyping(conversation.id, value.trim().length > 0);
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => {
      sendTyping(conversation.id, false);
    }, 2500);
  };

  const handleFilePicked = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setSendError('Ukuran berkas melebihi batas maksimum 25 MB.');
      return;
    }
    setSendError(null);
    setSelectedFile(file);
  };

  const submitMessage = async (e?: FormEvent) => {
    e?.preventDefault();
    if (sending || isBlocked) return;
    if (!selectedFile && !text.trim()) return;

    setSending(true);
    setSendError(null);
    try {
      sendTyping(conversation.id, false);
      if (selectedFile) {
        await sendFileMessage(conversation.id, selectedFile, text, token, user, privateKey);
        setSelectedFile(null);
      } else {
        await sendTextMessage(conversation.id, text, token, user, privateKey);
      }
      setText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      setShowEmojiPicker(false);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Gagal mengirim pesan.');
    } finally {
      setSending(false);
    }
  };

  const handleComposerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submitMessage();
    }
  };

  const jumpToMessage = (messageId: string) => {
    const el = document.getElementById(`message-${messageId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <main className="flex-1 flex flex-col h-full min-w-0 chat-canvas-surface md:rounded-2xl md:border md:border-[var(--border-subtle)] shadow-sm overflow-hidden">
      <header className="min-h-14 px-3 sm:px-4 py-2 bg-[var(--bg-sidebar)] border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={onBackMobile}
            aria-label="Kembali ke daftar chat"
            className="md:hidden w-9 h-9 rounded-lg text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center justify-center shrink-0"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onCloseConversation}
            aria-label="Tutup ruang obrolan"
            title="Tutup obrolan"
            className="hidden md:inline-flex w-8 h-8 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] items-center justify-center shrink-0 transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>

          <div
            aria-hidden="true"
            className="hidden md:block h-4 w-px bg-[var(--border-subtle)] mx-0.5 shrink-0"
          />

          <div className="hidden md:flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              disabled={!hasPrevConversation}
              onClick={onPrevConversation}
              aria-label="Obrolan sebelumnya"
              title="Obrolan sebelumnya"
              className="w-8 h-8 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-35 inline-flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={!hasNextConversation}
              onClick={onNextConversation}
              aria-label="Obrolan berikutnya"
              title="Obrolan berikutnya"
              className="w-8 h-8 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-35 inline-flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleInfo}
            className="flex items-center gap-2.5 min-w-0 text-left rounded-xl px-2 py-1 hover:bg-[var(--bg-hover)] transition-colors"
          >
            <Avatar
              name={headerTitle}
              avatarUrl={isGroup ? conversation.avatarUrl : peer?.avatarUrl}
              isOnline={peer?.isOnline}
              isGroup={isGroup}
              size="sm"
            />
            <div className="min-w-0">
              <h1 className="text-[13.5px] font-semibold truncate">{headerTitle}</h1>
              <p
                className={`text-[11.5px] truncate ${
                  typingIds.length > 0 ? 'text-[var(--status-e2ee)] font-medium' : 'text-[var(--text-secondary)]'
                }`}
              >
                {statusLine}
              </p>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!isGroup && peer && (
            <button
              type="button"
              onClick={onOpenSafetyModal}
              aria-label="Lihat verifikasi keamanan obrolan"
              title="Verifikasi Keamanan"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--status-e2ee)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Terenkripsi</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowInChatSearch((prev) => !prev)}
            aria-label="Cari pesan di obrolan ini"
            title="Cari pesan"
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              showInChatSearch
                ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            <Search className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onToggleInfo}
            aria-label="Buka informasi percakapan"
            title="Info ruang obrolan"
            className="w-8 h-8 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center justify-center transition-colors"
          >
            <Info className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      {showInChatSearch && (
        <div className="px-4 py-2 bg-[var(--bg-sidebar)] border-b border-[var(--border-subtle)] flex items-center gap-2 shrink-0">
          <label htmlFor="inchat-search" className="sr-only">
            Cari kata kunci dalam pesan
          </label>
          <input
            id="inchat-search"
            type="search"
            autoFocus
            value={inChatQuery}
            onChange={(e) => setInChatQuery(e.target.value)}
            placeholder="Cari kata di obrolan ini..."
            className="flex-1 h-8 px-3 rounded-lg bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-xs"
          />
          <button
            type="button"
            onClick={() => {
              setInChatQuery('');
              setShowInChatSearch(false);
            }}
            aria-label="Tutup pencarian pesan"
            className="p-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 sm:px-8 py-5">
        <div className="max-w-3xl mx-auto space-y-1">
          <div className="flex justify-center mb-5">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--bg-sidebar)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] text-center max-w-md">
              <Lock className="w-3.5 h-3.5 shrink-0 text-[var(--status-e2ee)]" aria-hidden="true" />
              <span>Obrolan dan kiriman file di ruang ini terlindungi enkripsi end-to-end.</span>
            </div>
          </div>

          {isLoadingMsgs && messages.length === 0 ? (
            <div className="py-10 text-center text-sm text-[var(--text-secondary)]">
              Memuat obrolan...
            </div>
          ) : msgsError ? (
            <div role="alert" className="p-4 rounded-2xl border border-[var(--status-danger)] text-center space-y-2">
              <p className="text-sm text-[var(--status-danger)]">{msgsError}</p>
              <button
                type="button"
                onClick={() => void selectConversation(conversation.id, token, user, privateKey)}
                className="px-4 py-1.5 rounded-full bg-[var(--bg-sidebar)] border border-[var(--border-subtle)] text-xs font-medium"
              >
                Coba Lagi
              </button>
            </div>
          ) : visibleMessages.length === 0 ? (
            <div className="py-10 text-center text-sm text-[var(--text-secondary)]">
              {inChatQuery
                ? 'Tidak ditemukan pesan yang cocok dengan kata kunci tersebut.'
                : 'Belum ada pesan. Sapa dulu di bawah.'}
            </div>
          ) : (
            visibleMessages.map((msg, idx) => {
              const prev = visibleMessages[idx - 1];
              const next = visibleMessages[idx + 1];
              const showDateDivider =
                !prev ||
                new Date(prev.createdAt).toDateString() !== new Date(msg.createdAt).toDateString();
              const nextShowsDateDivider =
                !next ||
                new Date(next.createdAt).toDateString() !== new Date(msg.createdAt).toDateString();
              const isFirstInGroup = showDateDivider || !prev || prev.senderId !== msg.senderId;
              const isLastInGroup = nextShowsDateDivider || !next || next.senderId !== msg.senderId;
              const sender = conversation.members.find((m) => m.userId === msg.senderId);

              return (
                <div key={msg.id}>
                  {showDateDivider && (
                    <div className="flex justify-center my-4">
                      <span className="px-3.5 py-1 rounded-full bg-[var(--bg-sidebar)] text-xs font-medium text-[var(--text-secondary)]">
                        {formatDateHeading(msg.createdAt)}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    message={msg}
                    isMine={msg.senderId === user.id}
                    isFirstInGroup={isFirstInGroup}
                    isLastInGroup={isLastInGroup}
                    showSenderName={isGroup}
                    senderName={sender?.displayName ?? 'Pengguna'}
                    otherMemberCount={Math.max(conversation.members.length - 1, 1)}
                    onReply={(m) => {
                      setReplyTarget(m);
                      textareaRef.current?.focus();
                    }}
                    onJumpToMessage={jumpToMessage}
                    onReact={(msgId, emoji) => toggleReaction(conversation.id, msgId, emoji)}
                    onDelete={(msgId, mode) => deleteMessage(conversation.id, msgId, mode)}
                    onPreviewImage={onPreviewImage}
                  />
                </div>
              );
            })
          )}
          <div ref={streamEndRef} />
        </div>
      </div>

      <div className="mx-3 mb-3 sm:mx-5 sm:mb-4 rounded-2xl bg-[var(--bg-input)] border border-[var(--border-subtle)] shadow-sm shrink-0 overflow-visible has-[textarea:focus-visible]:outline has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-[var(--accent-primary)] has-[textarea:focus-visible]:outline-offset-2">
        {replyTarget && (
          <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3">
            <div className="min-w-0 pl-3 border-l-[3px] border-[var(--status-e2ee)]">
              <p className="text-xs font-semibold text-[var(--status-e2ee)]">
                Membalas{' '}
                {conversation.members.find((m) => m.userId === replyTarget.senderId)?.displayName ??
                  'Pengguna'}
              </p>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                {replyTarget.decrypted?.text || replyTarget.decrypted?.media?.fileName || 'Pesan'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReplyTarget(null)}
              aria-label="Batalkan balasan"
              className="p-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {selectedFile && (
          <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="w-5 h-5 text-[var(--status-e2ee)] shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs tabular-nums text-[var(--text-secondary)]">
                  {(selectedFile.size / 1024).toFixed(1)} KB · Akan dienkripsi otomatis
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedFile(null)}
              aria-label="Hapus lampiran terpilih"
              className="p-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {sendError && (
          <div
            role="alert"
            className="px-4 py-2 border-b border-[var(--status-danger)] flex items-center justify-between gap-2 text-xs text-[var(--status-danger)]"
          >
            <span className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{sendError}</span>
            </span>
            <button type="button" onClick={() => setSendError(null)} aria-label="Tutup peringatan">
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {isBlocked ? (
          <div className="px-4 py-3.5 text-center text-sm text-[var(--text-secondary)]">
            Anda memblokir kontak ini. Buka blokir di Info Kontak untuk kembali mengirim pesan.
          </div>
        ) : (
          <form
            onSubmit={(e) => void submitMessage(e)}
            className="relative px-2.5 sm:px-3.5 py-2 flex items-end gap-1.5"
          >
            {showEmojiPicker && (
              <div className="absolute bottom-16 left-2 z-20 p-2 rounded-2xl bg-[var(--bg-sidebar)] border border-[var(--border-subtle)] shadow-xl grid grid-cols-6 gap-1">
                {COMPOSER_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      handleTextChange(text + emoji);
                      textareaRef.current?.focus();
                    }}
                    className="w-9 h-9 rounded-xl hover:bg-[var(--bg-hover)] text-lg flex items-center justify-center"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              aria-label="Pilih emoji"
              title="Emoji"
              className="min-w-[42px] min-h-[42px] p-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center justify-center shrink-0"
            >
              <Smile className="w-5 h-5" aria-hidden="true" />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFilePicked}
              aria-label="Unggah gambar atau dokumen"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Lampirkan gambar atau dokumen"
              title="Lampirkan gambar atau dokumen (maks. 25 MB)"
              className="min-w-[42px] min-h-[42px] p-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center justify-center shrink-0"
            >
              <Paperclip className="w-5 h-5" aria-hidden="true" />
            </button>

            <div className="flex-1 min-w-0">
              <label htmlFor="chat-composer" className="sr-only">
                Ketik pesan
              </label>
              <textarea
                ref={textareaRef}
                id="chat-composer"
                rows={1}
                value={text}
                onChange={(e) => handleTextChange(e.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder={selectedFile ? 'Tambahkan keterangan...' : 'Tulis pesan santai...'}
                className="w-full px-2 py-2.5 bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] text-sm resize-none max-h-28 focus-visible:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={sending || (!text.trim() && !selectedFile)}
              aria-label="Kirim pesan"
              className="min-w-[40px] min-h-[40px] w-[40px] h-[40px] rounded-xl bg-[var(--accent-primary)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] disabled:opacity-45 flex items-center justify-center shrink-0 transition-colors"
            >
              <SendHorizontal className="w-4 h-4" aria-hidden="true" />
            </button>
          </form>
        )}
      </div>
    </main>
  );
};


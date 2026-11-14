import { useEffect, useRef, useState, type FC } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useChatStore } from '../../stores/useChatStore';
import { ProfileSettingsModal } from '../auth/ProfileSettingsModal';
import { RecoveryKeyModal } from '../auth/RecoveryKeyModal';
import { ChatCanvas } from '../chat/ChatCanvas';
import { ImageLightbox } from '../chat/ImageLightbox';
import { InfoDrawer } from '../chat/InfoDrawer';
import { SafetyNumberModal } from '../chat/SafetyNumberModal';
import { CreateGroupModal } from '../group/CreateGroupModal';
import { AppRail, type ChatFolderTab } from './AppRail';
import { Sidebar } from './Sidebar';

export const ChatLayout: FC = () => {
  const { token, user, privateKey } = useAuthStore();
  const {
    conversations,
    activeConversationId,
    initializeSession,
    selectConversation,
    resetSession,
    setReplyTarget,
  } = useChatStore();

  const [filterTab, setFilterTab] = useState<ChatFolderTab>('all');
  const [railCollapsed, setRailCollapsed] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1100 : false
  );
  const [showInfoDrawer, setShowInfoDrawer] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; fileName: string } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token || !user || !privateKey) return;
    void initializeSession(token, user, privateKey);
    return () => {
      resetSession();
    };
  }, [token, user?.id, privateKey, initializeSession, resetSession]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (
        e.key === 'Escape' &&
        !showNewGroup &&
        !showSettings &&
        !showSafetyModal &&
        !lightbox
      ) {
        if (useChatStore.getState().replyTarget) {
          setReplyTarget(null);
        } else if (showInfoDrawer) {
          setShowInfoDrawer(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showNewGroup, showSettings, showSafetyModal, lightbox, showInfoDrawer, setReplyTarget]);

  if (!token || !user || !privateKey) return null;

  const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? null;
  const activePeer =
    activeConversation?.type === 'direct'
      ? activeConversation.members.find((m) => m.userId !== user.id) ?? null
      : null;

  const currentIdx = activeConversation
    ? conversations.findIndex((c) => c.id === activeConversation.id)
    : -1;
  const prevConversation = currentIdx > 0 ? conversations[currentIdx - 1] : null;
  const nextConversation =
    currentIdx >= 0 && currentIdx < conversations.length - 1
      ? conversations[currentIdx + 1]
      : null;

  const focusSidebarSearch = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768 && activeConversation) {
      void selectConversation(null, token, user, privateKey);
    }
    window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 30);
  };

  return (
    <div className="h-dvh w-full overflow-hidden flex bg-[var(--bg-app)] text-[var(--text-primary)] md:p-2.5 md:gap-2.5">
      <AppRail
        collapsed={railCollapsed}
        activeTab={filterTab}
        onSelectTab={setFilterTab}
        onNewChat={focusSidebarSearch}
        onOpenNewGroup={() => setShowNewGroup(true)}
        onOpenSettings={() => setShowSettings(true)}
      />

      <div className={`${activeConversation ? 'hidden md:flex' : 'flex'} w-full md:w-auto h-full`}>
        <Sidebar
          searchInputRef={searchInputRef}
          filterTab={filterTab}
          onChangeFilterTab={setFilterTab}
          railCollapsed={railCollapsed}
          onToggleRail={() => setRailCollapsed((prev) => !prev)}
          onOpenNewGroup={() => setShowNewGroup(true)}
          onOpenSettings={() => setShowSettings(true)}
        />
      </div>

      <div className={`${activeConversation ? 'flex' : 'hidden md:flex'} flex-1 h-full min-w-0`}>
        <ChatCanvas
          conversation={activeConversation}
          onBackMobile={() => {
            setShowInfoDrawer(false);
            void selectConversation(null, token, user, privateKey);
          }}
          onCloseConversation={() => {
            setShowInfoDrawer(false);
            void selectConversation(null, token, user, privateKey);
          }}
          onPrevConversation={() => {
            if (prevConversation) {
              setShowInfoDrawer(false);
              void selectConversation(prevConversation.id, token, user, privateKey);
            }
          }}
          onNextConversation={() => {
            if (nextConversation) {
              setShowInfoDrawer(false);
              void selectConversation(nextConversation.id, token, user, privateKey);
            }
          }}
          hasPrevConversation={Boolean(prevConversation)}
          hasNextConversation={Boolean(nextConversation)}
          onFocusSearch={() => searchInputRef.current?.focus()}
          onOpenNewGroup={() => setShowNewGroup(true)}
          onToggleInfo={() => setShowInfoDrawer((prev) => !prev)}
          onOpenSafetyModal={() => setShowSafetyModal(true)}
          onPreviewImage={(src, fileName) => setLightbox({ src, fileName })}
        />
      </div>

      {showInfoDrawer && activeConversation && (
        <InfoDrawer
          conversation={activeConversation}
          onClose={() => setShowInfoDrawer(false)}
          onOpenSafetyModal={() => setShowSafetyModal(true)}
        />
      )}

      <RecoveryKeyModal />
      <CreateGroupModal open={showNewGroup} onClose={() => setShowNewGroup(false)} />
      <ProfileSettingsModal open={showSettings} onClose={() => setShowSettings(false)} />

      {activePeer && (
        <SafetyNumberModal
          open={showSafetyModal}
          onClose={() => setShowSafetyModal(false)}
          myPublicKey={user.publicKey}
          peerPublicKey={activePeer.publicKey}
          peerName={activePeer.displayName}
          peerUsername={activePeer.username}
        />
      )}

      <ImageLightbox
        src={lightbox?.src ?? null}
        fileName={lightbox?.fileName ?? ''}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
};

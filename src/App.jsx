import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider, useSocket } from './context/SocketContext';
import { Header } from './components/Header';
import { BottomTabBar } from './components/BottomTabBar';
import { InstallPrompt } from './components/InstallPrompt';
import { MatchView } from './views/MatchView';
import { FriendsView } from './views/FriendsView';
import { DiscoverView } from './views/DiscoverView';
import { ProfileView } from './views/ProfileView';
import { LoginView } from './views/LoginView';
import { LogoutConfirmationDialog } from './components/LogoutConfirmationDialog';
import { GuestUpgradeModal } from './components/GuestUpgradeModal';
import { LiveFriendRequestAlert } from './components/LiveFriendRequestAlert';
import { LiveRandomMessageAlert } from './components/LiveRandomMessageAlert';
import { LiveWaveAlert } from './components/LiveWaveAlert';

function AppContent() {
  const { isAuthenticated, isGuest, authLoading, showLogoutModal, cancelLogout, performLogout } = useAuth();
  const { activeTab, setActiveTab } = useSocket();
  // Friend to open in the Friends tab when another view (Discover, wave alert) asks for a DM
  const [dmTargetId, setDmTargetId] = useState(null);

  const openFriendChat = (friendId) => {
    setDmTargetId(friendId);
    setActiveTab('friends');
  };

  // A pending DM hand-off only applies to the Friends tab it was made for
  useEffect(() => {
    if (activeTab !== 'friends') setDmTargetId(null);
  }, [activeTab]);

  // Discover is registered-users only; a guest session (or a downgrade) falls back to Match.
  useEffect(() => {
    if (isGuest && activeTab === 'discover') setActiveTab('match');
  }, [isGuest, activeTab, setActiveTab]);

  // 1. Initial Auth check loading state on landing
  if (authLoading) {
    return (
      <div className="landing-auth-loading">
        <div className="loading-content">
          <div className="loading-logo animate-glow">⚡</div>
          <h2>Verifying RandoMeet Session...</h2>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated state on landing -> Show Login / Auth Page
  if (!isAuthenticated) {
    return <LoginView />;
  }

  // 3. Authenticated state -> Main App Layout
  return (
    <div className="app-container">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="main-content" key={activeTab}>
        {activeTab === 'match' && <MatchView />}
        {activeTab === 'discover' && !isGuest && <DiscoverView onOpenChat={openFriendChat} />}
        {activeTab === 'friends' && (
          <FriendsView
            onStartMatch={() => setActiveTab('match')}
            initialFriendId={dmTargetId}
            onInitialFriendHandled={() => setDmTargetId(null)}
          />
        )}
        {activeTab === 'profile' && <ProfileView />}
      </main>

      <BottomTabBar activeTab={activeTab} setActiveTab={setActiveTab} />

      <LogoutConfirmationDialog
        isOpen={showLogoutModal}
        onClose={cancelLogout}
        onConfirm={performLogout}
      />
      <GuestUpgradeModal />
      <LiveFriendRequestAlert />
      <LiveRandomMessageAlert />
      <LiveWaveAlert onOpenChat={openFriendChat} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AppContent />
        <InstallPrompt />
      </SocketProvider>
    </AuthProvider>
  );
}

import React, { Suspense, lazy, useEffect, useState } from 'react';
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
import { NotificationToasts, NotificationPermissionPrompt } from './components/NotificationToasts';
import { ProfileCardProvider } from './components/ProfileCard';
import { subscribeNavigate } from './services/notify';
import { setScreen } from './services/analytics';
import { checkAnalyticsAdmin } from './views/admin/adminApi';

// Admin-only, so it is split out of the main bundle.
const AdminAnalyticsView = lazy(() => import('./views/admin/AdminAnalyticsView'));

function AppContent() {
  const { user, isAuthenticated, authLoading, showLogoutModal, cancelLogout, performLogout } = useAuth();
  const { activeTab, setActiveTab } = useSocket();
  // Friend to open in the Friends tab when another view (Discover, notifications) asks for a DM
  const [dmTargetId, setDmTargetId] = useState(null);
  const [isAnalyticsAdmin, setIsAnalyticsAdmin] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Screen views for analytics: the login page until signed in, then the active tab.
  useEffect(() => {
    if (authLoading) return;
    if (showAnalytics) setScreen('admin_analytics');
    else setScreen(isAuthenticated ? activeTab : 'login');
  }, [authLoading, isAuthenticated, activeTab, showAnalytics]);

  // Microsoft Clarity records page text by default. Once signed in, mask everything (chats, toasts,
  // profile cards rendered in portals) so recordings show layout and clicks, never messages.
  useEffect(() => {
    if (isAuthenticated) document.body.setAttribute('data-clarity-mask', 'true');
    else document.body.removeAttribute('data-clarity-mask');
  }, [isAuthenticated]);

  // The server decides who is an admin; the button only appears when it says yes.
  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated || !user || user.isGuest || user.guest) {
      setIsAnalyticsAdmin(false);
      setShowAnalytics(false);
      return undefined;
    }
    checkAnalyticsAdmin().then((ok) => { if (!cancelled) setIsAnalyticsAdmin(ok); });
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const openFriendChat = (friendId) => {
    setDmTargetId(friendId);
    setActiveTab('friends');
  };

  // A tapped toast or browser notification opens the screen it is about.
  useEffect(() => subscribeNavigate((target) => {
    if (target.tab === 'friends' && target.friendId) {
      setDmTargetId(target.friendId);
      setActiveTab('friends');
    } else if (target.tab) {
      setActiveTab(target.tab);
    }
  }), [setActiveTab]);

  // A pending DM hand-off only applies to the Friends tab it was made for
  useEffect(() => {
    if (activeTab !== 'friends') setDmTargetId(null);
  }, [activeTab]);

  // 1. Initial Auth check loading state on landing
  if (authLoading) {
    return (
      <div className="landing-auth-loading">
        <div className="loading-content">
          <div className="loading-logo">RandomChatly</div>
          <h2>Verifying RandomChatly Session...</h2>
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
    <div className="app-container" data-clarity-mask="true">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAnalytics={isAnalyticsAdmin ? () => setShowAnalytics(true) : null}
      />
      
      <main className="main-content" key={activeTab}>
        {activeTab === 'match' && <MatchView />}
        {activeTab === 'discover' && <DiscoverView onOpenChat={openFriendChat} />}
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
      {showAnalytics && isAnalyticsAdmin && (
        <Suspense fallback={<div className="an-root" />}>
          <AdminAnalyticsView onClose={() => setShowAnalytics(false)} />
        </Suspense>
      )}
      <NotificationToasts />
      <NotificationPermissionPrompt />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <ProfileCardProvider>
          <AppContent />
          <InstallPrompt />
        </ProfileCardProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

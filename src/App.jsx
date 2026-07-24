import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { Header } from './components/Header';
import { MatchView } from './views/MatchView';
import { FriendsView } from './views/FriendsView';
import { ProfileView } from './views/ProfileView';
import { LoginView } from './views/LoginView';

function AppContent() {
  const { isAuthenticated, authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('match');

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
      
      <main className="main-content">
        {activeTab === 'match' && <MatchView />}
        {activeTab === 'friends' && <FriendsView onStartMatch={() => setActiveTab('match')} />}
        {activeTab === 'profile' && <ProfileView />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AppContent />
      </SocketProvider>
    </AuthProvider>
  );
}

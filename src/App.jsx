import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { Header } from './components/Header';
import { MatchView } from './views/MatchView';
import { FriendsView } from './views/FriendsView';
import { ProfileView } from './views/ProfileView';

function AppContent() {
  const [activeTab, setActiveTab] = useState('match');

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

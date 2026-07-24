import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AVATAR_LIST = [
  { icon: '👾', bg: '#8b5cf6', label: 'Alien' },
  { icon: '🦊', bg: '#f97316', label: 'Fox' },
  { icon: '🚀', bg: '#06b6d4', label: 'Rocket' },
  { icon: '⚡', bg: '#eab308', label: 'Flash' },
  { icon: '🐱', bg: '#ec4899', label: 'Cyber Cat' },
  { icon: '🐼', bg: '#10b981', label: 'Panda' },
  { icon: '💎', bg: '#3b82f6', label: 'Diamond' },
  { icon: '🔮', bg: '#a855f7', label: 'Mystic' }
];

export const INTEREST_TAGS = [
  'Gaming', 'Music', 'Tech', 'Anime', 'Movies', 
  'Crypto', 'Fitness', 'Art', 'Travel', 'Reading', 'Chatting'
];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('randomeet_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      id: 'user_' + Math.random().toString(36).substring(2, 9),
      name: 'VibeSeeker' + Math.floor(Math.random() * 900 + 100),
      avatar: '⚡',
      avatarBg: '#8b5cf6',
      gender: 'Non-binary',
      interests: ['Tech', 'Gaming', 'Music'],
      bio: 'Here to make awesome random friends worldwide!'
    };
  });

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [friends, setFriends] = useState(() => {
    const saved = localStorage.getItem('randomeet_friends');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      {
        id: 'friend_1',
        name: 'Aria Synth',
        avatar: '🐱',
        avatarBg: '#ec4899',
        status: 'Online',
        lastMessage: 'Hey! Catch you later in the chat!',
        unread: 1,
        interests: ['Music', 'Anime']
      },
      {
        id: 'friend_2',
        name: 'Neo Matrix',
        avatar: '🚀',
        avatarBg: '#06b6d4',
        status: 'Offline',
        lastMessage: 'Check out this cool new track!',
        unread: 0,
        interests: ['Tech', 'Gaming']
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem('randomeet_user', JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem('randomeet_friends', JSON.stringify(friends));
  }, [friends]);

  const updateUserProfile = (updated) => {
    setUser(prev => ({ ...prev, ...updated }));
  };

  const addFriend = (newFriend) => {
    setFriends(prev => {
      if (prev.some(f => f.id === newFriend.id)) return prev;
      return [...prev, { ...newFriend, status: 'Online', lastMessage: 'Added as friend!', unread: 0 }];
    });
  };

  const removeFriend = (friendId) => {
    setFriends(prev => prev.filter(f => f.id !== friendId));
  };

  return (
    <AuthContext.Provider value={{
      user,
      updateUserProfile,
      soundEnabled,
      setSoundEnabled,
      friends,
      addFriend,
      removeFriend
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

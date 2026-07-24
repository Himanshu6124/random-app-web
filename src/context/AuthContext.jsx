import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [jwtToken, setJwtToken] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [profilePictures, setProfilePictures] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Persisted friends list — starts empty, filled via addFriend
  const [friends, setFriends] = useState(() => {
    const saved = localStorage.getItem('randomeet_friends');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });

  // On landing: verify stored session and fetch profile pictures from API
  useEffect(() => {
    let isMounted = true;
    async function initLandingAuth() {
      try {
        const [res, pics] = await Promise.all([
          authService.checkLandingAuth(),
          authService.getProfilePictures().catch(() => [])
        ]);

        if (isMounted) {
          setIsAuthenticated(res.isAuthenticated);
          setUser(res.user);
          // checkLandingAuth returns { jwt } now
          setJwtToken(res.jwt || null);
          if (Array.isArray(pics) && pics.length > 0) {
            setProfilePictures(pics);
          }
        }
      } catch (err) {
        if (isMounted) {
          setIsAuthenticated(false);
          setUser(null);
          setJwtToken(null);
        }
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    }

    initLandingAuth();
    return () => { isMounted = false; };
  }, []);

  // Persist friends to localStorage
  useEffect(() => {
    localStorage.setItem('randomeet_friends', JSON.stringify(friends));
  }, [friends]);

  /**
   * Login with username + password
   * authService.login returns { authResponse: { userId, jwt }, user }
   */
  const login = async (username, password) => {
    setAuthError('');
    try {
      const res = await authService.login(username, password);
      setIsAuthenticated(true);
      setUser(res.user);
      setJwtToken(res.authResponse.jwt);
      return res;
    } catch (err) {
      setAuthError(err.message || 'Login failed.');
      throw err;
    }
  };

  /**
   * Register a new account
   * authService.signUp returns { authResponse: { userId, jwt }, user }
   */
  const signUp = async (userData) => {
    setAuthError('');
    try {
      const res = await authService.signUp(userData);
      setIsAuthenticated(true);
      setUser(res.user);
      setJwtToken(res.authResponse.jwt);
      return res;
    } catch (err) {
      setAuthError(err.message || 'Sign up failed.');
      throw err;
    }
  };

  const logout = () => {
    authService.clearSession();
    setIsAuthenticated(false);
    setUser(null);
    setJwtToken(null);
    setAuthError('');
  };

  const updateUserProfile = (updated) => {
    setUser(prev => {
      const nextUser = { ...prev, ...updated };
      authService.setSession({ userId: nextUser?.id, jwt: jwtToken }, nextUser);
      return nextUser;
    });
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

  const clearAuthError = () => setAuthError('');

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      jwtToken,
      user,
      profilePictures,
      authLoading,
      authError,
      clearAuthError,
      login,
      signUp,
      logout,
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

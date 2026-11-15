import React, { useState } from 'react';
import { MessageSquare, Compass, Users, Lock, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { haptic, isIOS } from '../mobile/nativeShell';

/**
 * Native-style bottom tab bar, shown only on phone-sized screens (see mobile.css).
 * Mirrors the Header's tab rules: Discover & Friends are locked for guests.
 */
export function BottomTabBar({ activeTab, setActiveTab }) {
  const { user, isGuest, openUpgradeModal, totalUnreadFriendsCount } = useAuth();
  const { unreadRandomCount } = useSocket();

  const tabs = [
    { id: 'match', label: 'Match', Icon: MessageSquare, badge: unreadRandomCount },
    {
      id: 'discover', label: 'Discover', Icon: Compass, locked: isGuest,
      lockReason: 'find friends, see who is nearby and keep your match history',
    },
    {
      id: 'friends', label: 'Friends', Icon: Users, locked: isGuest,
      badge: isGuest ? 0 : totalUnreadFriendsCount,
      lockReason: 'access Friends & Direct Messages',
    },
    { id: 'profile', label: 'Profile', avatar: true },
  ];

  const [tapped, setTapped] = useState(null);

  const select = (tab) => {
    // On iOS the tick comes from the finger toggling the native switch overlay
    // below (iOS 26.5+ ignores switches toggled from script).
    if (!isIOS) haptic();
    setTapped(tab.id);
    setTimeout(() => setTapped(null), 450);
    if (tab.locked) {
      openUpgradeModal(tab.lockReason);
      return;
    }
    if (tab.id === activeTab) {
      // Re-tapping the active tab scrolls its content to the top, like native apps.
      document.querySelector('.main-content [data-scroll-root], .main-content')
        ?.querySelectorAll('*')
        .forEach((el) => { if (el.scrollTop > 0 && el.scrollHeight > el.clientHeight) el.scrollTo({ top: 0, behavior: 'smooth' }); });
      return;
    }
    setActiveTab(tab.id);
  };

  return (
    <nav className="bottom-tabbar" aria-label="Primary">
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <div key={tab.id} className="tabbar-slot">
          <button
            type="button"
            tabIndex={isIOS ? -1 : undefined}
            className={`tabbar-item${active ? ' is-active' : ''}${tab.locked ? ' is-locked' : ''}${tapped === tab.id ? ' just-tapped' : ''}`}
            onClick={() => select(tab)}
            aria-current={active ? 'page' : undefined}
            aria-label={tab.locked ? `${tab.label} (sign up to unlock)` : tab.label}
          >
            <span className="tabbar-icon">
              {tab.avatar ? (
                <span className="tabbar-avatar">
                  {user?.photoUrl
                    ? <img src={user.photoUrl} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    : <UserRound size={16} aria-hidden="true" />}
                </span>
              ) : (
                <tab.Icon size={22} strokeWidth={active ? 2.4 : 1.9} />
              )}
              {tab.locked && <Lock className="tabbar-lock" size={10} strokeWidth={2.6} />}
              {tab.badge > 0 && <span className="tabbar-badge">{tab.badge > 99 ? '99+' : tab.badge}</span>}
            </span>
            <span className="tabbar-label">{tab.label}</span>
          </button>
          {isIOS && (
            // Invisible native switch covering the tab: the user's own tap toggles
            // it, which is the only way iOS web apps get a system haptic tick.
            // The label forwards a second click to the input; ignore that one.
            <label
              className="tabbar-haptic"
              aria-hidden="true"
              onClick={(e) => { if (e.target === e.currentTarget) select(tab); }}
            >
              <input type="checkbox" switch="" tabIndex={-1} />
            </label>
          )}
          </div>
        );
      })}
    </nav>
  );
}

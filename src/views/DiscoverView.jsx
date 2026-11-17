import React, { useState } from 'react';
import { DiscoverSidebar, DiscoverSegmented } from '../components/discover/DiscoverSidebar';
import { FindFriendsPanel } from '../components/discover/FindFriendsPanel';
import { NearbyPanel } from '../components/discover/NearbyPanel';
import { MatchHistoryPanel } from '../components/discover/MatchHistoryPanel';
import '../styles/discover.css';

/**
 * Discover tab: Find friends (people search), Nearby (approximate-location map of everyone
 * around you, friends highlighted) and Match history (who you met in Random Match). Open to everyone, guests included.
 */
export function DiscoverView({ onOpenChat }) {
  const [section, setSection] = useState('find');

  return (
    <div className="discover-view">
      <div className="discover-layout">
        <DiscoverSidebar
          section={section}
          onSelect={setSection}
        />
        <div className="discover-main">
          <DiscoverSegmented section={section} onSelect={setSection} />
          {section === 'find' && <FindFriendsPanel onOpenChat={onOpenChat} />}
          {section === 'nearby' && <NearbyPanel onOpenChat={onOpenChat} />}
          {section === 'history' && <MatchHistoryPanel onOpenChat={onOpenChat} />}
        </div>
      </div>
    </div>
  );
}

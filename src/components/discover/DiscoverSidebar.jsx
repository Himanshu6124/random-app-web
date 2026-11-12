import React from 'react';
import { Search, MapPin, History, ShieldCheck } from 'lucide-react';

export const DISCOVER_SECTIONS = [
  { id: 'find', title: 'Find friends', short: 'Find', sub: 'Search by name or @username', Icon: Search },
  { id: 'nearby', title: 'Nearby friends', short: 'Nearby', sub: 'See friends on a map', Icon: MapPin },
  { id: 'history', title: 'Match history', short: 'History', sub: "People you've met", Icon: History }
];

/** Desktop section navigation with the privacy note. */
export function DiscoverSidebar({ section, onSelect, onManageVisibility }) {
  return (
    <aside className="discover-sidebar">
      <span className="discover-sidebar-label">Discover</span>
      <nav aria-label="Discover">
        {DISCOVER_SECTIONS.map(({ id, title, sub, Icon }) => (
          <button
            key={id}
            type="button"
            className="discover-nav-item"
            aria-current={section === id ? 'page' : undefined}
            onClick={() => onSelect(id)}
          >
            <span className="discover-nav-icon"><Icon size={18} aria-hidden="true" /></span>
            <span className="discover-nav-text">
              <span className="discover-nav-title">{title}</span>
              <span className="discover-nav-sub">{sub}</span>
            </span>
          </button>
        ))}
      </nav>

      <div className="discover-privacy">
        <div className="discover-privacy-title"><ShieldCheck size={16} aria-hidden="true" />Your privacy</div>
        <p>Friends see your area, never your exact spot. Strangers never see your location.</p>
        <button type="button" className="dc-link" onClick={onManageVisibility}>Manage visibility</button>
      </div>
    </aside>
  );
}

/** Phone section switcher (replaces the sidebar under 768px). */
export function DiscoverSegmented({ section, onSelect }) {
  return (
    <nav className="discover-segmented" aria-label="Discover sections">
      {DISCOVER_SECTIONS.map(({ id, short }) => (
        <button key={id} type="button" aria-current={section === id ? 'page' : undefined} onClick={() => onSelect(id)}>
          {short}
        </button>
      ))}
    </nav>
  );
}

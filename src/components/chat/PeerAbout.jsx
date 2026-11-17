import React from 'react';
import { MATCH_TOPICS } from '../../content/matchTopics';

const TOPIC_BY_ID = Object.fromEntries(MATCH_TOPICS.map((t) => [t.id, t]));

/** The peer's bio and picked interests. Renders nothing when they have neither. */
export function PeerAbout({ bio, topics = [], sharedTopics = [], compact = false }) {
  const known = (topics || []).map((id) => TOPIC_BY_ID[id]).filter(Boolean);
  const shared = new Set(sharedTopics || []);
  if (!bio && known.length === 0) return null;

  return (
    <div className={`peer-about${compact ? ' peer-about--compact' : ''}`}>
      {bio && <p className="peer-about__bio">“{bio}”</p>}
      {known.length > 0 && (
        <ul className="peer-about__topics" aria-label="Interests">
          {known.map((t) => (
            <li key={t.id} className={`peer-about__topic${shared.has(t.id) ? ' is-shared' : ''}`}>
              <span aria-hidden="true">{t.emoji}</span>{t.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

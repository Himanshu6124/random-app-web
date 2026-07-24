import React from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth, INTEREST_TAGS } from '../context/AuthContext';
import { Sparkles, Sliders, XCircle, Search } from 'lucide-react';

export function MatchRadar() {
  const { user } = useAuth();
  const {
    matchState,
    filters,
    setFilters,
    toggleInterestFilter,
    startSearching,
    cancelSearch
  } = useSocket();

  const isSearching = matchState === 'searching';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      width: '100%',
      maxWidth: '720px',
      margin: 'auto'
    }}>
      {/* Radar Animation Area */}
      <div style={{
        position: 'relative',
        width: '260px',
        height: '260px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '32px'
      }}>
        {/* Radar Pulse Rings */}
        {isSearching && (
          <>
            <div style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              border: '2px solid var(--primary-purple)',
              animation: 'radarPulse 2.4s infinite cubic-bezier(0.215, 0.61, 0.355, 1)',
            }} />
            <div style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              border: '2px solid var(--cyan-accent)',
              animation: 'radarPulse 2.4s infinite cubic-bezier(0.215, 0.61, 0.355, 1) 0.8s',
            }} />
          </>
        )}

        {/* Center User Avatar */}
        <div style={{
          position: 'relative',
          zIndex: 10,
          width: '110px',
          height: '110px',
          borderRadius: '50%',
          backgroundColor: '#8b5cf6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '3.5rem',
          boxShadow: 'var(--shadow-glow)',
          border: '4px solid rgba(255, 255, 255, 0.2)',
          overflow: 'hidden'
        }}>
          {user?.photoUrl ? (
            <img src={user.photoUrl} alt="Your Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display='none'; }} />
          ) : (
            '⚡'
          )}
        </div>
      </div>

      {/* Status Text */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '8px' }}>
          {isSearching ? 'Searching for a Stranger...' : 'Ready to Meet Someone New?'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          {isSearching 
            ? 'Scanning users worldwide based on your interest filters' 
            : 'Match anonymously with random people and start chatting instantly'}
        </p>
      </div>

      {/* Search / Cancel Button */}
      <div style={{ marginBottom: '40px' }}>
        {isSearching ? (
          <button
            onClick={cancelSearch}
            className="btn-danger"
            style={{ padding: '14px 32px', fontSize: '1rem', borderRadius: 'var(--radius-full)' }}
          >
            <XCircle size={20} />
            <span>Cancel Search</span>
          </button>
        ) : (
          <button
            onClick={startSearching}
            className="btn-primary"
            style={{ padding: '16px 48px', fontSize: '1.1rem', borderRadius: 'var(--radius-full)' }}
          >
            <Search size={22} />
            <span>Find a Match Now</span>
          </button>
        )}
      </div>

      {/* Interest & Gender Filters */}
      <div className="glass-panel" style={{ width: '100%', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Sliders size={18} color="var(--primary-purple)" />
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Match Filters</h3>
        </div>

        {/* Gender Selection */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>
            Gender Preference:
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['All', 'Male', 'Female'].map(g => (
              <button
                key={g}
                onClick={() => setFilters(prev => ({ ...prev, gender: g }))}
                className={filters.gender === g ? 'btn-cyan' : 'btn-secondary'}
                style={{ padding: '8px 16px', fontSize: '0.85rem', flex: 1 }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Interest Tags */}
        <div>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '10px', display: 'block' }}>
            Topics of Interest:
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {INTEREST_TAGS.map(tag => {
              const isSelected = filters.interests.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleInterestFilter(tag)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-full)',
                    border: isSelected ? '1px solid var(--primary-purple)' : '1px solid var(--border-color)',
                    background: isSelected ? 'rgba(139, 92, 246, 0.25)' : 'rgba(255,255,255,0.04)',
                    color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {isSelected && <Sparkles size={12} color="var(--primary-purple)" />}
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

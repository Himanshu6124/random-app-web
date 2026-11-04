import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { XCircle, Zap } from 'lucide-react';

const DOT_COUNT = 8;

/**
 * MatchRadar — Home screen + searching animation
 *
 * States:
 *  idle      → Show "Find a Match" CTA with user avatar
 *  searching → Full animated radar with orbiting dots (matches Android's HomeScreenV2 canvas animation)
 */
export function MatchRadar() {
  const { user } = useAuth();
  const {
    matchState,
    startSearching,
    cancelSearch
  } = useSocket();

  const isSearching = matchState === 'searching';

  // Elapsed time counter shown while searching
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!isSearching) { setElapsed(0); return; }
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [isSearching]);

  const formatElapsed = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `0:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="radar-container">

      {isSearching ? (
        /* ── SEARCHING STATE ─ Full animated radar like Android HomeScreenV2 ── */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px', width: '100%' }}>

          {/* Radar Animation */}
          <div className="radar-animation-box" style={{ position: 'relative', width: '300px', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

            {/* Pulsing rings */}
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                position: 'absolute',
                width: `${60 + i * 60}px`,
                height: `${60 + i * 60}px`,
                borderRadius: '50%',
                border: `${i === 1 ? 2 : 1}px solid ${i === 1 ? 'var(--primary-purple)' : i === 2 ? 'var(--cyan-accent)' : 'rgba(139,92,246,0.3)'}`,
                animation: `radarPulse ${1.8 + i * 0.6}s infinite cubic-bezier(0.215, 0.61, 0.355, 1) ${i * 0.4}s`,
                opacity: i === 3 ? 0.4 : 1
              }} />
            ))}

            {/* Rotating orbit ring with dots */}
            {Array.from({ length: DOT_COUNT }).map((_, i) => {
              const angle = (i / DOT_COUNT) * 360;
              const radius = 110;
              const rad = (angle * Math.PI) / 180;
              const x = Math.cos(rad) * radius;
              const y = Math.sin(rad) * radius;
              const size = i % 3 === 0 ? 10 : i % 3 === 1 ? 7 : 5;
              const colors = ['var(--primary-purple)', 'var(--cyan-accent)', 'var(--pink-accent)', 'var(--green-accent)'];
              const color = colors[i % colors.length];
              return (
                <div key={i} style={{
                  position: 'absolute',
                  width: `${size}px`,
                  height: `${size}px`,
                  borderRadius: '50%',
                  background: color,
                  boxShadow: `0 0 8px ${color}`,
                  transform: `translate(${x}px, ${y}px)`,
                  animation: `orbitSpin 4s linear infinite`,
                  animationDelay: `${-(i / DOT_COUNT) * 4}s`,
                  transformOrigin: `${-x}px ${-y}px`
                }} />
              );
            })}

            {/* Center avatar */}
            <div style={{
              position: 'relative',
              zIndex: 10,
              width: '90px',
              height: '90px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary-purple)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.5rem',
              boxShadow: 'var(--shadow-glow)',
              border: '3px solid rgba(255,255,255,0.25)',
              overflow: 'hidden',
              animation: 'glowPulse 2s infinite ease-in-out'
            }}>
              {user?.photoUrl
                ? <img src={user.photoUrl} alt="You" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} />
                : '⚡'
              }
            </div>
          </div>

          {/* Status */}
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '8px', background: 'linear-gradient(135deg, var(--primary-purple), var(--cyan-accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Finding Your Match...
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '8px' }}>
              Looking for someone who is online right now
            </p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', padding: '6px 16px', borderRadius: 'var(--radius-full)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green-accent)', boxShadow: 'var(--green-glow)', animation: 'glowPulse 1s infinite', display: 'inline-block' }} />
              Searching · {formatElapsed(elapsed)}
            </div>
          </div>

          {/* Cancel button */}
          <button
            onClick={cancelSearch}
            className="btn-danger"
            style={{ padding: '14px 36px', fontSize: '1rem', borderRadius: 'var(--radius-full)' }}
          >
            <XCircle size={18} />
            <span>Cancel</span>
          </button>

        </div>

      ) : (
        /* ── IDLE STATE ─ Home screen CTA ── */
        <>
          {/* User avatar with glow */}
          <div style={{
            position: 'relative',
            width: '130px',
            height: '130px',
            marginBottom: '24px'
          }}>
            <div style={{
              position: 'absolute',
              inset: '-12px',
              borderRadius: '50%',
              background: 'conic-gradient(from 0deg, var(--primary-purple), var(--cyan-accent), var(--pink-accent), var(--primary-purple))',
              opacity: 0.4,
              filter: 'blur(12px)',
              animation: 'orbitSpin 6s linear infinite'
            }} />
            <div style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              backgroundColor: 'var(--primary-purple)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '4rem',
              boxShadow: 'var(--shadow-glow)',
              border: '4px solid rgba(255,255,255,0.15)',
              overflow: 'hidden'
            }}>
              {user?.photoUrl
                ? <img src={user.photoUrl} alt="You" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} />
                : '⚡'
              }
            </div>
          </div>

          {/* Headline */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '10px', background: 'linear-gradient(135deg, #ffffff 0%, var(--primary-purple) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Meet Someone New
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '360px', lineHeight: '1.6' }}>
              Match anonymously with random people from around the world and start chatting instantly
            </p>
          </div>

          {/* FIND A MATCH BUTTON — main CTA */}
          <button
            id="find-match-btn"
            onClick={startSearching}
            className="btn-primary"
            style={{
              padding: '18px 56px',
              fontSize: '1.15rem',
              fontWeight: 700,
              borderRadius: 'var(--radius-full)',
              marginBottom: '40px',
              boxShadow: '0 0 40px rgba(139, 92, 246, 0.45)',
              letterSpacing: '0.3px'
            }}
          >
            <Zap size={22} style={{ fill: 'white' }} />
            <span>Find a Match</span>
          </button>

        </>
      )}

      {/* CSS for orbit animation */}
      <style>{`
        @keyframes orbitSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

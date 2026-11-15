import React, { useEffect, useRef, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { MatchRadar } from '../components/MatchRadar';
import { ChatBox } from '../components/ChatBox';

/**
 * MatchView manages the three-state flow exactly like the Android app:
 *   idle      → Show "Find a Match" home screen (MatchRadar idle)
 *   searching → Animated radar / scanning screen (MatchRadar searching)
 *   matched   → Chat screen slides in full-screen (ChatBox)
 *
 * Transitions mirror the kmp-migration branch navigation:
 *   HomeScreenV2 → (match found) → navigate to ChatScreen
 */
export function MatchView() {
  const { matchState } = useSocket();

  // Track previous state to animate the chat screen slide-in
  const [showChat, setShowChat] = useState(false);
  const [chatMounted, setChatMounted] = useState(false);

  // A match found while you watched the radar plays its lock-on first; one already
  // standing (tab switch, rejoin) opens the chat straight away.
  const prevMatchState = useRef(matchState);

  useEffect(() => {
    const prev = prevMatchState.current;
    prevMatchState.current = matchState;

    if (matchState === 'matched') {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const delay = prev === 'searching' ? (reduced ? 300 : 1150) : 0;
      let raf;
      const timer = setTimeout(() => {
        // Mount first, then animate in (like Android's enter transition)
        setChatMounted(true);
        raf = requestAnimationFrame(() => {
          raf = requestAnimationFrame(() => setShowChat(true));
        });
      }, delay);
      return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
    } else {
      // Animate out then unmount
      setShowChat(false);
      const timer = setTimeout(() => setChatMounted(false), 400);
      return () => clearTimeout(timer);
    }
  }, [matchState]);

  return (
    <div style={{
      display: 'flex',
      flex: 1,
      height: '100%',
      width: '100%',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* MatchRadar — always rendered (idle + searching states) */}
      <div className="match-radar-layer" style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        overflowY: 'auto',
        padding: '16px',
        opacity: chatMounted ? 0 : 1,
        transform: chatMounted ? 'scale(0.96)' : 'scale(1)',
        transition: 'opacity 0.35s ease, transform 0.35s ease',
        pointerEvents: chatMounted ? 'none' : 'auto'
      }}>
        <MatchRadar />
      </div>

      {/* ChatBox — slides in over the top like Android navigation */}
      {chatMounted && (
        <div className="match-chat-layer chat-active" style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          padding: '16px',
          opacity: showChat ? 1 : 0,
          transform: showChat ? 'translateY(0)' : 'translateY(32px)',
          transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <ChatBox />
        </div>
      )}
    </div>
  );
}

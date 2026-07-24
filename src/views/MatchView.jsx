import React from 'react';
import { useSocket } from '../context/SocketContext';
import { MatchRadar } from '../components/MatchRadar';
import { ChatBox } from '../components/ChatBox';

export function MatchView() {
  const { matchState } = useSocket();

  return (
    <div style={{
      display: 'flex',
      flex: 1,
      height: '100%',
      width: '100%',
      padding: '16px',
      overflow: 'hidden'
    }}>
      {matchState === 'matched' ? (
        <ChatBox />
      ) : (
        <MatchRadar />
      )}
    </div>
  );
}

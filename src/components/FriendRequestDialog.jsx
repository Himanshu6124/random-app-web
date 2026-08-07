import React from 'react';
import { X, Check, Loader2 } from 'lucide-react';

export function FriendRequestDialog({
  friendRequests = [],
  isLoading = false,
  onDismiss,
  onAccept,
  onReject
}) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div className="glass-panel animate-scale-up" style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: '#1C1C1E',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '24px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
            Friend Requests
          </h2>
          <button
            onClick={onDismiss}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '180px',
            color: 'var(--primary-purple)'
          }}>
            <Loader2 size={32} className="animate-spin" />
          </div>
        ) : friendRequests.length === 0 ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '180px',
            color: 'var(--text-muted)',
            fontSize: '0.9rem'
          }}>
            No pending friend requests
          </div>
        ) : (
          <div style={{
            maxHeight: '360px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {friendRequests.map((request) => {
              const reqId = request.username || request.id;
              return (
                <div
                  key={reqId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    backgroundColor: '#2C2C2E',
                    borderRadius: '14px',
                    border: '1px solid rgba(255, 255, 255, 0.05)'
                  }}
                >
                  {/* Profile Image & User Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                    <div style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      backgroundColor: '#8b5cf6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.3rem',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}>
                      {request.photoUrl ? (
                        <img
                          src={request.photoUrl}
                          alt={request.name || request.username}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        '👤'
                      )}
                    </div>

                    <div style={{ overflow: 'hidden' }}>
                      <div style={{
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        color: '#ffffff',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {request.name || request.username || 'Unknown'}
                      </div>
                      {request.username && (
                        <div style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          @{request.username}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions: Reject (Red X) & Accept (Green Check) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <button
                      onClick={() => onReject(reqId)}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: '#FF3B30',
                        border: 'none',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'transform 0.15s ease'
                      }}
                      title="Reject"
                    >
                      <X size={18} />
                    </button>

                    <button
                      onClick={() => onAccept(reqId)}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: '#34C759',
                        border: 'none',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'transform 0.15s ease'
                      }}
                      title="Accept"
                    >
                      <Check size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

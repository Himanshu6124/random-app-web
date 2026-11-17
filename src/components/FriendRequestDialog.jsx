import React from 'react';
import { Portal } from './Portal';
import { X, Check, Loader2, UserRound } from 'lucide-react';

export function FriendRequestDialog({
  friendRequests = [],
  isLoading = false,
  onDismiss,
  onAccept,
  onReject
}) {
  return (
    <Portal>
    <div className="m-sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--scrim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px'
      }}
    >
      <div className="glass-panel animate-scale-up m-sheet" style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: '#21141f',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border-color)',
        padding: '24px',
        boxShadow: 'var(--shadow-pop)',
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
          <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Friend Requests
          </h2>
          <button
            id="close-requests-modal-btn"
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
            fontSize: 'var(--fs-body-sm)'
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
              // Identity for accept/reject is the stable user id.
              const reqId = request.id || request.friendUserId;
              return (
                <div
                  key={reqId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    backgroundColor: '#2a1a27',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  {/* Profile Image & User Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                    <div style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--plum-4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 'var(--fs-xl)',
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
                        <UserRound size={18} aria-hidden="true" />
                      )}
                    </div>

                    <div style={{ overflow: 'hidden' }}>
                      <div style={{
                        fontWeight: 600,
                        fontSize: 'var(--fs-body)',
                        color: 'var(--text-primary)',
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
                        backgroundColor: 'var(--danger-fill)',
                        border: 'none',
                        color: 'var(--text-primary)',
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
                        backgroundColor: 'var(--accent)',
                        border: 'none',
                        color: 'var(--accent-ink)',
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
    </Portal>
  );
}

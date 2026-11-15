import React, { useEffect } from 'react';
import { feedback } from '../mobile/feedback';
import { LogOut } from 'lucide-react';

export function LogoutConfirmationDialog({ isOpen, onClose, onConfirm }) {
  useEffect(() => { if (isOpen) feedback('warning'); }, [isOpen]);
  if (!isOpen) return null;

  return (
    <div className="m-sheet-backdrop" style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'var(--scrim)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div className="glass-panel animate-scale-up m-sheet" style={{
        width: '100%',
        maxWidth: '400px',
        backgroundColor: '#21141f',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        padding: '28px 24px',
        boxShadow: 'var(--shadow-pop)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        textAlign: 'left'
      }}>
        {/* Title */}
        <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Confirm Sign Out
        </h2>

        {/* Description */}
        <p style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '24px' }}>
          Are you sure you want to log out? You will need to sign in again to connect with friends.
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            style={{ flex: 1, padding: '12px 16px', borderRadius: 'var(--radius-md)', fontWeight: 600 }}
          >
            Cancel
          </button>
          
          <button
            type="button"
            className="btn-danger"
            onClick={onConfirm}
            style={{ flex: 1, padding: '12px 16px', borderRadius: 'var(--radius-md)', justifyContent: 'center' }}
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

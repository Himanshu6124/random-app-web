import React, { useState } from 'react';
import { UserPlus, UserCheck, Clock, Check, Ban } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { isBotUserId, useResolvedFriendStatus } from '../../services/botPeers';

/**
 * The relationship action for one person, driven by the backend's friendship status
 * (NONE, PENDING_SENT, PENDING_RECEIVED, ACCEPTED, BLOCKED). Reports the new status upward.
 * Works the same for every listed profile, bots included (see services/botPeers).
 */
export function FriendshipButton({ personId, name, status = 'NONE', onStatusChange, onMessage, onError, size = 'md' }) {
  const { user, jwtToken, isGuest, openUpgradeModal, sendFriendRequest, cancelFriendRequest, acceptFriendRequest, unblockUser, loadFriendsFromApi } = useAuth();
  const [busy, setBusy] = useState(false);
  const sm = size === 'sm' ? ' dc-btn--sm' : '';
  const shownStatus = useResolvedFriendStatus(user?.id, personId, status);

  const run = async (action, nextStatus) => {
    // Friends need an account: a guest is asked to sign in, and the request goes out afterwards.
    if (isGuest && (nextStatus === 'PENDING_SENT' || nextStatus === 'ACCEPTED')) {
      openUpgradeModal(
        nextStatus === 'ACCEPTED' ? `Sign in to accept ${name}'s friend request.` : `Sign in to add ${name} as a friend.`,
        { action: nextStatus === 'ACCEPTED' ? 'ACCEPT_FRIEND' : 'SEND_FRIEND', targetUserId: personId }
      );
      return;
    }
    setBusy(true);
    try {
      await action();
      onStatusChange?.(nextStatus);
    } catch (err) {
      onError?.(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  switch (shownStatus) {
    case 'PENDING_SENT':
      return (
        <button
          type="button"
          className={`dc-btn dc-btn--ghost${sm}`}
          disabled={busy}
          title="Cancel friend request"
          aria-label={`Cancel friend request to ${name}`}
          onClick={() => run(() => cancelFriendRequest(personId), 'NONE')}
        >
          <Clock size={16} aria-hidden="true" />Requested
        </button>
      );
    case 'PENDING_RECEIVED':
      return (
        <button
          type="button"
          className={`dc-btn dc-btn--primary${sm}`}
          disabled={busy}
          aria-label={`Accept friend request from ${name}`}
          onClick={() => run(() => acceptFriendRequest(personId), 'ACCEPTED')}
        >
          <UserCheck size={16} aria-hidden="true" />Accept
        </button>
      );
    case 'ACCEPTED':
      return (
        <button
          type="button"
          className={`dc-btn dc-btn--ghost${sm}`}
          title="Open chat"
          aria-label={`Friends with ${name}. Open chat`}
          onClick={() => onMessage?.()}
        >
          <Check size={16} aria-hidden="true" />Friends
        </button>
      );
    case 'BLOCKED':
      return (
        <button
          type="button"
          className={`dc-btn dc-btn--ghost${sm}`}
          disabled={busy}
          title="Unblock"
          aria-label={`${name} is blocked. Unblock`}
          onClick={() => run(async () => {
            if (isBotUserId(personId)) {
              await unblockUser(personId); // device-only for bots
              return;
            }
            await authService.removeFriendApi(personId, jwtToken || authService.getToken());
            await loadFriendsFromApi?.();
          }, 'NONE')}
        >
          <Ban size={16} aria-hidden="true" />Blocked
        </button>
      );
    default:
      return (
        <button
          type="button"
          className={`dc-btn dc-btn--primary dc-btn--icon-mobile${sm}`}
          disabled={busy}
          aria-label={`Add ${name} as a friend`}
          onClick={() => run(() => sendFriendRequest(personId), 'PENDING_SENT')}
        >
          <UserPlus size={18} aria-hidden="true" /><span className="dc-btn-label-desktop">Add friend</span>
        </button>
      );
  }
}

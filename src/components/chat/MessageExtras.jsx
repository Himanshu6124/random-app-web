import React, { useEffect, useRef, useState } from 'react';
import { Reply, SmilePlus, Trash2, X } from 'lucide-react';
import { REACTION_EMOJIS, myReactionOn, previewText } from './messageUtils';
import '../../styles/messageExtras.css';
import { feedback } from '../../mobile/feedback';

const LONG_PRESS_MS = 420;
// Swipe right on a bubble to reply: how far the finger must travel to lock the swipe, to
// trigger the reply, and how far the bubble may follow the finger.
const SWIPE_LOCK_PX = 10;
const SWIPE_TRIGGER_PX = 56;
const SWIPE_MAX_PX = 88;

/** The quoted message shown at the top of a reply bubble. */
export function ReplyQuote({ quoted, authorLabel, onJump }) {
  return (
    <button
      type="button"
      className="reply-quote"
      onClick={(e) => {
        e.stopPropagation();
        onJump?.();
      }}
      disabled={!quoted}
      aria-label={quoted ? `Replying to ${authorLabel}: ${previewText(quoted)}. Show message` : 'Original message unavailable'}
    >
      <span className="reply-quote__author">{quoted ? authorLabel : 'Reply'}</span>
      <span className="reply-quote__text">{previewText(quoted)}</span>
    </button>
  );
}

/** "Replying to …" strip that sits right above the composer. */
export function ReplyComposerBar({ target, authorLabel, onCancel }) {
  if (!target) return null;
  return (
    <div className="reply-bar" role="status">
      <Reply size={16} aria-hidden="true" className="reply-bar__icon" />
      <div className="reply-bar__body">
        <span className="reply-bar__author">Replying to {authorLabel}</span>
        <span className="reply-bar__text">{previewText(target)}</span>
      </div>
      <button type="button" className="reply-bar__close" onClick={onCancel} aria-label="Cancel reply">
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

/** Reaction pills under a bubble. Tapping your own pill removes your reaction. */
export function ReactionPills({ msg, myId, isMe, onToggle }) {
  const reactions = [msg.reactEmojiSender, msg.reactEmojiReceiver].filter(Boolean);
  if (reactions.length === 0) return null;

  const mine = myReactionOn(msg, myId);
  const grouped = reactions.reduce((acc, e) => {
    acc[e] = (acc[e] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className={`reaction-pills ${isMe ? 'reaction-pills--me' : 'reaction-pills--them'}`} data-msg-interactive>
      {Object.entries(grouped).map(([emoji, count]) => {
        const isMine = mine === emoji;
        return (
          <button
            key={emoji}
            type="button"
            className={`reaction-pill${isMine ? ' reaction-pill--mine' : ''}`}
            onClick={() => (isMine ? onToggle?.(emoji) : undefined)}
            aria-label={isMine ? `${emoji} reaction from you. Tap to remove` : `${emoji} reaction`}
            aria-disabled={!isMine}
          >
            <span aria-hidden="true">{emoji}</span>
            {count > 1 && <span className="reaction-pill__count">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Wraps one chat bubble with reply + react controls.
 *  - Desktop: controls appear beside the bubble on hover / focus; double-click hearts it.
 *  - Touch: long-press the bubble to show them; double-tap hearts it; swipe it right to reply.
 * Render <ReplyQuote> inside the bubble (children) when the message is a reply.
 */
export function MessageShell({
  msg,
  isMe,
  myId,
  interactions,
  enabled = true,
  onReply,
  onReact,
  onDelete,
  children
}) {
  const { activeId, setActiveId, pickerId, setPickerId, close } = interactions;
  const isActive = activeId === msg.id;
  const pickerOpen = pickerId === msg.id;
  const pressTimer = useRef(null);
  const pressStart = useRef(null);
  const longPressed = useRef(false);
  const bubbleRef = useRef(null);
  const hintRef = useRef(null);
  const swipe = useRef(null);
  const swiped = useRef(false);
  const mine = myReactionOn(msg, myId);
  // Delete for everyone: only my own messages, two taps (trash, then "Delete").
  const canDelete = Boolean(isMe && onDelete);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => () => clearTimeout(pressTimer.current), []);
  useEffect(() => { if (!isActive && !pickerOpen) setConfirmDelete(false); }, [isActive, pickerOpen]);

  const deleteButton = (className) => canDelete && (
    <button
      type="button"
      className={`${className} msg-delete-btn${confirmDelete ? ' is-confirm' : ''}`}
      onClick={() => {
        if (!confirmDelete) {
          setActiveId(msg.id);
          setConfirmDelete(true);
          return;
        }
        onDelete(msg);
        setConfirmDelete(false);
        close();
      }}
      aria-label={confirmDelete ? 'Confirm delete for everyone' : 'Delete for everyone'}
      title={confirmDelete ? 'Tap again to delete for everyone' : 'Delete for everyone'}
    >
      <Trash2 size={16} aria-hidden="true" />
      {confirmDelete && <span>Delete</span>}
    </button>
  );

  const react = (emoji) => {
    // Picking the reaction you already have removes it
    onReact?.(msg, mine === emoji ? null : emoji);
    close();
  };

  if (!enabled) {
    return (
      <div className={`msg-row ${isMe ? 'msg-row--me' : 'msg-row--them'}`}>
        <div className="msg-stack">
          {children}
        </div>
      </div>
    );
  }

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse') return;
    longPressed.current = false;
    swiped.current = false;
    pressStart.current = { x: e.clientX, y: e.clientY };
    swipe.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, locked: false, dead: false, dx: 0 };
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setActiveId(msg.id);
      setPickerId(msg.id);
      feedback('long');
    }, LONG_PRESS_MS);
  };
  const cancelPress = () => clearTimeout(pressTimer.current);

  // Swipe: the bubble follows a rightward finger, a reveal arrow grows, and past the trigger the
  // message becomes a reply. Vertical movement hands the gesture back to scrolling.
  const showSwipe = (travel) => {
    const bubble = bubbleRef.current;
    const hint = hintRef.current;
    if (bubble) {
      bubble.style.transition = 'none';
      bubble.style.transform = travel ? `translate3d(${travel}px, 0, 0)` : '';
    }
    if (hint) hint.style.opacity = String(Math.min(1, travel / SWIPE_TRIGGER_PX));
  };
  const onPointerMove = (e) => {
    const start = pressStart.current;
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) cancelPress();

    const s = swipe.current;
    if (!s || s.dead || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x0;
    const dy = e.clientY - s.y0;
    if (!s.locked) {
      if (Math.abs(dy) > SWIPE_LOCK_PX && Math.abs(dy) >= Math.abs(dx)) {
        s.dead = true;
        return;
      }
      if (dx > SWIPE_LOCK_PX && dx > Math.abs(dy) * 1.5) {
        s.locked = true;
        swiped.current = true;
        cancelPress();
        try { bubbleRef.current?.setPointerCapture?.(e.pointerId); } catch { /* not supported */ }
      }
    }
    if (s.locked) {
      s.dx = Math.min(Math.max(dx, 0), SWIPE_MAX_PX);
      showSwipe(s.dx);
    }
  };
  const finishSwipe = (cancelled) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || !s.locked) return;
    const reply = !cancelled && s.dx >= SWIPE_TRIGGER_PX;
    showSwipe(0);
    if (hintRef.current) hintRef.current.style.opacity = '0';
    if (reply) {
      feedback('tap');
      onReply?.(msg);
    }
  };

  return (
    <div
      className={`msg-row ${isMe ? 'msg-row--me' : 'msg-row--them'}${isActive || pickerOpen ? ' is-active' : ''}`}
      data-msg-interactive={isActive || pickerOpen ? '' : undefined}
    >
      <span ref={hintRef} className="msg-swipe-hint" aria-hidden="true">
        <Reply size={16} />
      </span>
      <div className="msg-stack">
        <div
          id={`msg-${msg.id}`}
          ref={bubbleRef}
          className="msg-bubble-hit"
          onPointerDown={onPointerDown}
          onPointerUp={() => { cancelPress(); finishSwipe(false); }}
          onPointerCancel={() => { cancelPress(); finishSwipe(true); }}
          onPointerMove={onPointerMove}
          onContextMenu={(e) => {
            // Long-press on Android fires contextmenu; keep the native menu out of the way
            if (e.nativeEvent?.pointerType !== 'mouse') e.preventDefault();
          }}
          onClickCapture={(e) => {
            // The click that ends a long-press or a swipe must not also open media / jump quotes
            if (longPressed.current || swiped.current) {
              e.stopPropagation();
              e.preventDefault();
              longPressed.current = false;
            }
          }}
          onDoubleClick={() => react('❤️')}
        >
          {children}
        </div>
        <ReactionPills msg={msg} myId={myId} isMe={isMe} onToggle={() => react(mine)} />
      </div>

      <div className="msg-actions" data-msg-interactive>
        <button
          type="button"
          className="msg-action-btn"
          onClick={() => {
            onReply?.(msg);
            close();
          }}
          aria-label="Reply"
          title="Reply"
        >
          <Reply size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`msg-action-btn${pickerOpen ? ' is-on' : ''}`}
          onClick={() => {
            setActiveId(msg.id);
            setPickerId(pickerOpen ? null : msg.id);
          }}
          aria-label="React"
          aria-expanded={pickerOpen}
          title="React"
        >
          <SmilePlus size={16} aria-hidden="true" />
        </button>
        {!pickerOpen && deleteButton('msg-action-btn')}

        {pickerOpen && (
          <div className={`reaction-picker ${isMe ? 'reaction-picker--me' : 'reaction-picker--them'}`} role="menu" aria-label="Pick a reaction">
            {REACTION_EMOJIS.map(emoji => (
              <button
                key={emoji}
                type="button"
                role="menuitemradio"
                aria-checked={mine === emoji}
                className={`reaction-picker__emoji${mine === emoji ? ' is-on' : ''}`}
                onClick={() => react(emoji)}
                aria-label={mine === emoji ? `Remove ${emoji}` : `React ${emoji}`}
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              className="reaction-picker__reply"
              onClick={() => {
                onReply?.(msg);
                close();
              }}
              aria-label="Reply"
            >
              <Reply size={16} aria-hidden="true" />
            </button>
            {deleteButton('reaction-picker__reply')}
          </div>
        )}
      </div>
    </div>
  );
}

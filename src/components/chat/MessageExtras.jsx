import React, { useEffect, useRef } from 'react';
import { Reply, SmilePlus, X } from 'lucide-react';
import { REACTION_EMOJIS, myReactionOn, previewText } from './messageUtils';
import '../../styles/messageExtras.css';
import { haptic } from '../../mobile/nativeShell';

const LONG_PRESS_MS = 420;

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
 *  - Touch: long-press the bubble to show them; double-tap hearts it.
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
  children
}) {
  const { activeId, setActiveId, pickerId, setPickerId, close } = interactions;
  const isActive = activeId === msg.id;
  const pickerOpen = pickerId === msg.id;
  const pressTimer = useRef(null);
  const pressStart = useRef(null);
  const longPressed = useRef(false);
  const mine = myReactionOn(msg, myId);

  useEffect(() => () => clearTimeout(pressTimer.current), []);

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
    pressStart.current = { x: e.clientX, y: e.clientY };
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setActiveId(msg.id);
      setPickerId(msg.id);
      haptic(12);
    }, LONG_PRESS_MS);
  };
  const cancelPress = () => clearTimeout(pressTimer.current);
  const onPointerMove = (e) => {
    const start = pressStart.current;
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) cancelPress();
  };

  return (
    <div
      className={`msg-row ${isMe ? 'msg-row--me' : 'msg-row--them'}${isActive || pickerOpen ? ' is-active' : ''}`}
      data-msg-interactive={isActive || pickerOpen ? '' : undefined}
    >
      <div className="msg-stack">
        <div
          id={`msg-${msg.id}`}
          className="msg-bubble-hit"
          onPointerDown={onPointerDown}
          onPointerUp={cancelPress}
          onPointerCancel={cancelPress}
          onPointerMove={onPointerMove}
          onContextMenu={(e) => {
            // Long-press on Android fires contextmenu; keep the native menu out of the way
            if (e.nativeEvent?.pointerType !== 'mouse') e.preventDefault();
          }}
          onClickCapture={(e) => {
            // The click that ends a long-press must not also open media / jump quotes
            if (longPressed.current) {
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
          </div>
        )}
      </div>
    </div>
  );
}

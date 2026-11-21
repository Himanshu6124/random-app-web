import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Camera, Mic, Send, X, ArrowUp, ChevronUp, Trash2 } from 'lucide-react';
import { useMediaComposer, formatMs, hasSeparateCameraPicker } from './MediaComposer';
import { PhotoEditor } from './chat/PhotoEditor';
import { VoiceWaveform } from './VoiceWaveform';
import { MAX_MESSAGE_LENGTH } from '../services/socketService';
import { feedback } from '../mobile/feedback';

const CANCEL_SLIDE_PX = 90;   // slide this far up while holding to discard
const ARM_SLIDE_PX = 36;      // past this the cancel hint turns red
const MIN_HOLD_MS = 500;      // shorter than this is a tap, not a voice note
const COACH_KEY = 'voiceHoldCoachSeen';

const coachSeen = () => {
  try { return window.localStorage.getItem(COACH_KEY) === '1'; } catch { return true; }
};
const markCoachSeen = () => {
  try { window.localStorage.setItem(COACH_KEY, '1'); } catch { /* ignore */ }
};

/**
 * WhatsApp-style message bar shared by the random chat and friend DMs:
 *
 *   [leading]  ( message …            [image] )  [mic | send]
 *
 * The round button is a mic by default and turns into Send only once the message field has
 * at least one typed character (focusing the empty field keeps the mic).
 *
 * Photos: the gallery button (plus a camera button on Android, whose picker has no camera option)
 * opens the photo editor: crop, stickers, text, drawing, a caption and the view-once switch.
 *
 * Voice notes: press and HOLD the mic to record, release to send, slide up to cancel.
 * A quick tap explains the gesture. Keyboard users (Enter / Space on the mic) get the
 * tap-to-start recorder with explicit discard / send buttons.
 */
export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onBlur,
  onKeyDown,
  inputRef,
  disabled = false,
  placeholder = 'Message',
  leading = null,
  conversationId,
  onSendMedia,
  onMediaPending,
  onMediaFailed,
  onMediaError,
  sendClassName = 'btn-primary',
  peerName = ''
}) {
  const [focused, setFocused] = useState(false);
  const media = useMediaComposer({
    conversationId,
    onPending: (pending) => onMediaPending?.({ ...pending, viewOnce: Boolean(pending.viewOnce) && pending.type === 'IMAGE' }),
    onSend: (sent) => onSendMedia?.({ ...sent, viewOnce: Boolean(sent.viewOnce) && sent.type === 'IMAGE' }),
    onFailed: onMediaFailed,
    onError: onMediaError
  });
  const { configured, recording, elapsed, micStream } = media;

  // Hold-to-record gesture state
  const [holding, setHolding] = useState(false);   // finger / mouse is down on the mic
  const [slideY, setSlideY] = useState(0);          // how far up it has slid (px, >= 0)
  const [coach, setCoach] = useState(null);         // null | 'tap' | 'hold'
  const press = useRef(null);
  const mediaRef = useRef(media);
  mediaRef.current = media;
  const coachTimer = useRef(null);

  const hasText = value.trim().length > 0;
  const showSend = !recording && !holding && (hasText || !configured);
  // Background uploads never block: only an active recording does.
  const mediaBusy = recording;
  const mediaTitle = configured ? null : 'Media sharing is not configured yet';
  const holdMode = holding || (recording && press.current?.hold);

  const showCoach = (kind, ms = 3200) => {
    clearTimeout(coachTimer.current);
    setCoach(kind);
    if (ms) coachTimer.current = setTimeout(() => setCoach(null), ms);
  };
  useEffect(() => () => clearTimeout(coachTimer.current), []);

  // One tap / Enter = one send: a second submit of the same text right away (double tap,
  // keyboards that fire Enter twice) is ignored.
  const lastSubmit = useRef({ text: '', at: 0 });
  const submit = (e) => {
    e.preventDefault();
    if (recording) return;
    if (!hasText || disabled) return;
    const now = Date.now();
    if (lastSubmit.current.text === value && now - lastSubmit.current.at < 1000) return;
    lastSubmit.current = { text: value, at: now };
    onSubmit(value);
  };

  // Keep the keyboard up when tapping Send: blurring first would flip the button back to the
  // mic before the tap lands.
  const keepFocus = (e) => { if (showSend) e.preventDefault(); };

  // ---- Hold to record ----
  // Window listeners must be the same function objects across renders to be removable.
  const impl = useRef({});
  const listeners = useRef(null);
  if (!listeners.current) {
    listeners.current = {
      move: (e) => impl.current.onWindowMove(e),
      up: (e) => impl.current.onWindowUp(e),
      cancel: (e) => impl.current.onWindowCancel(e)
    };
  }
  const attach = () => {
    window.addEventListener('pointermove', listeners.current.move);
    window.addEventListener('pointerup', listeners.current.up);
    window.addEventListener('pointercancel', listeners.current.cancel);
  };
  const detach = () => {
    window.removeEventListener('pointermove', listeners.current.move);
    window.removeEventListener('pointerup', listeners.current.up);
    window.removeEventListener('pointercancel', listeners.current.cancel);
  };

  const endHold = () => {
    detach();
    setHolding(false);
    setSlideY(0);
  };

  const discardHold = (why) => {
    const p = press.current;
    if (p) p.done = true;
    endHold();
    if (mediaRef.current.recording || p?.started) mediaRef.current.cancelRecording();
    if (why === 'slide') {
      feedback('warning');
      markCoachSeen();
      setCoach(null);
    }
    press.current = null;
  };

  const finishHold = () => {
    const p = press.current;
    if (!p) return;
    p.released = true;
    endHold();
    if (!p.started) return; // mic still starting (permission prompt): settled when it resolves
    const heldMs = Date.now() - p.startedAt;
    press.current = null;
    if (heldMs < MIN_HOLD_MS) {
      mediaRef.current.cancelRecording();
      showCoach('tap');
      return;
    }
    feedback('send');
    markCoachSeen();
    setCoach(null);
    mediaRef.current.stopRecording();
  };

  function onWindowMove(e) {
    const p = press.current;
    if (!p || e.pointerId !== p.pointerId) return;
    const up = Math.max(0, p.y0 - e.clientY);
    setSlideY(up);
    if (up > CANCEL_SLIDE_PX) discardHold('slide');
  }
  function onWindowUp(e) {
    const p = press.current;
    if (!p || e.pointerId !== p.pointerId) return;
    finishHold();
  }
  function onWindowCancel(e) {
    const p = press.current;
    if (!p || e.pointerId !== p.pointerId) return;
    discardHold('cancel');
  }
  impl.current = { onWindowMove, onWindowUp, onWindowCancel };

  useEffect(() => () => detach(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const onMicPointerDown = async (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (disabled || mediaBusy || !configured || press.current) return;
    e.preventDefault();
    const p = { pointerId: e.pointerId, y0: e.clientY, hold: true, started: false, released: false, done: false, startedAt: 0 };
    press.current = p;
    setHolding(true);
    setSlideY(0);
    feedback('tap');
    if (!coachSeen()) showCoach('hold', 0);
    attach();

    const ok = await mediaRef.current.startRecording();
    if (p.done) {
      // Slid away / cancelled while the mic was starting.
      if (ok) mediaRef.current.cancelRecording();
      return;
    }
    if (!ok) {
      endHold();
      press.current = null;
      setCoach(null);
      return;
    }
    p.started = true;
    p.startedAt = Date.now();
    if (p.released) {
      // Let go before the mic was ready (usually the permission prompt): nothing to send.
      press.current = null;
      mediaRef.current.cancelRecording();
      showCoach('tap');
    }
  };

  // Enter / Space on the focused mic: tap-to-start recorder with explicit buttons.
  const onMicClick = (e) => {
    if (e.detail !== 0) return; // pointer clicks are handled by the hold gesture
    if (disabled || mediaBusy) return;
    press.current = null;
    media.startRecording();
  };

  const armed = slideY > ARM_SLIDE_PX;

  return (
    <form className="chat-composer wa-composer" onSubmit={submit}>
      {leading}

      {recording || holding ? (
        <div className={`wa-recorder${holdMode ? ' is-hold' : ''}`} role="group" aria-label="Recording voice note">
          {holdMode ? null : (
            <button
              type="button"
              className="wa-icon-btn wa-icon-btn--danger"
              onClick={media.cancelRecording}
              aria-label="Discard voice note"
              title="Discard"
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
          <span className="wa-recorder__dot" aria-hidden="true" />
          <span className="wa-recorder__time">{formatMs(recording ? elapsed : 0)}</span>
          <VoiceWaveform stream={micStream} />
          {holdMode && (
            <span className={`wa-recorder__slide${armed ? ' is-armed' : ''}`}>
              <ChevronUp size={15} aria-hidden="true" />
              {armed ? 'Keep sliding to cancel' : 'Slide up to cancel'}
            </span>
          )}
        </div>
      ) : (
        <div className={`wa-field${disabled ? ' is-disabled' : ''}${focused ? ' is-focused' : ''}`}>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={onChange}
            onFocus={() => setFocused(true)}
            onBlur={(e) => { setFocused(false); onBlur?.(e); }}
            onKeyDown={onKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            maxLength={MAX_MESSAGE_LENGTH}
            enterKeyHint="send"
            aria-label="Message"
          />
          <input
            ref={media.fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={media.onFileChange}
          />
          {/* capture opens the camera app directly (Android's photo picker has no camera option) */}
          <input
            ref={media.cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={media.onFileChange}
          />
          {hasSeparateCameraPicker && (
            <button
              type="button"
              id="attach-camera-btn"
              className="wa-icon-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={media.pickCamera}
              disabled={disabled || mediaBusy || !configured}
              aria-label="Take a photo"
              title={mediaTitle || 'Take a photo'}
            >
              <Camera size={20} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            id="attach-image-btn"
            className="wa-icon-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={media.pickImage}
            disabled={disabled || mediaBusy || !configured}
            aria-label={hasSeparateCameraPicker ? 'Send a photo from the gallery' : 'Send a photo'}
            title={mediaTitle || 'Send a photo'}
          >
            <ImageIcon size={20} aria-hidden="true" />
          </button>
        </div>
      )}

      {recording && !holdMode ? (
        <button
          type="button"
          id="voice-stop-btn"
          className={`${sendClassName} wa-round-btn`}
          onClick={media.stopRecording}
          disabled={disabled}
          aria-label="Send voice note"
          title="Send voice note"
        >
          <ArrowUp size={20} aria-hidden="true" />
        </button>
      ) : showSend ? (
        <button
          type="submit"
          className={`${sendClassName} wa-round-btn send-btn`}
          onMouseDown={keepFocus}
          onTouchStart={keepFocus}
          disabled={disabled || !hasText}
          aria-label="Send message"
        >
          <Send size={19} aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          id="voice-record-btn"
          className={`${sendClassName} wa-round-btn wa-mic-hold${holding ? ' is-holding' : ''}`}
          onPointerDown={onMicPointerDown}
          onClick={onMicClick}
          onContextMenu={(e) => e.preventDefault()}
          disabled={disabled}
          aria-label="Hold to record a voice note, release to send"
          title="Hold to record, release to send (max 2 min)"
          style={holding ? { transform: `translateY(${-Math.min(slideY, CANCEL_SLIDE_PX)}px) scale(1.28)` } : undefined}
        >
          <Mic size={20} aria-hidden="true" />
        </button>
      )}

      {holding && (
        <div className={`wa-cancel-zone${armed ? ' is-armed' : ''}`} aria-hidden="true">
          <Trash2 size={16} />
          <ChevronUp size={16} className="wa-cancel-zone__chev" />
        </div>
      )}

      {media.pickedFile && (
        <PhotoEditor
          file={media.pickedFile}
          peerName={peerName}
          onCancel={media.clearPicked}
          onSend={({ image, caption, viewOnce }) => media.sendImage(image, { caption, viewOnce })}
        />
      )}

      {coach && !(holding && coach === 'tap') && (
        <div className="wa-voice-coach" role="status">
          {coach === 'hold' ? (
            <>
              <strong>Release to send</strong>
              <span className="wa-voice-coach__row"><ChevronUp size={14} aria-hidden="true" />Slide up to cancel</span>
            </>
          ) : (
            <>
              <strong>Hold the mic to record</strong>
              <span className="wa-voice-coach__row">Release to send · slide up to cancel</span>
            </>
          )}
        </div>
      )}
    </form>
  );
}

import React, { useState } from 'react';
import { Image as ImageIcon, Mic, Send, X, ArrowUp } from 'lucide-react';
import { useMediaComposer, formatMs } from './MediaComposer';
import { VoiceWaveform } from './VoiceWaveform';
import { MAX_MESSAGE_LENGTH } from '../services/socketService';

/**
 * WhatsApp-style message bar shared by the random chat and friend DMs:
 *
 *   [leading]  ( message …            [image] )  [mic | send]
 *
 * The round button is a mic by default and turns into Send as soon as the message field is
 * focused or has text. While a voice note records, the field becomes the recorder (discard,
 * timer, live waveform) and the round button sends the note.
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
  onMediaError,
  sendClassName = 'btn-primary'
}) {
  const [focused, setFocused] = useState(false);
  const media = useMediaComposer({ conversationId, onSend: onSendMedia, onError: onMediaError });
  const { configured, uploading, progress, recording, elapsed, micStream } = media;

  const hasText = value.trim().length > 0;
  const showSend = !recording && (focused || hasText || !configured);
  const mediaBusy = uploading || recording;
  const mediaTitle = configured ? null : 'Media sharing is not configured yet';

  const submit = (e) => {
    e.preventDefault();
    if (recording) return;
    if (!hasText || disabled) return;
    onSubmit(value);
  };

  // Keep the keyboard up when tapping Send: blurring first would flip the button back to the
  // mic before the tap lands.
  const keepFocus = (e) => { if (showSend) e.preventDefault(); };

  return (
    <form className="chat-composer wa-composer" onSubmit={submit}>
      {leading}

      {recording ? (
        <div className="wa-recorder" role="group" aria-label="Recording voice note">
          <button
            type="button"
            className="wa-icon-btn wa-icon-btn--danger"
            onClick={media.cancelRecording}
            aria-label="Discard voice note"
            title="Discard"
          >
            <X size={18} aria-hidden="true" />
          </button>
          <span className="wa-recorder__dot" aria-hidden="true" />
          <span className="wa-recorder__time">{formatMs(elapsed)}</span>
          <VoiceWaveform stream={micStream} />
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
          {uploading && (
            <span className="wa-field__progress" id="media-upload-progress">{progress}%</span>
          )}
          <input
            ref={media.fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={media.onFileChange}
          />
          <button
            type="button"
            id="attach-image-btn"
            className="wa-icon-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={media.pickImage}
            disabled={disabled || mediaBusy || !configured}
            aria-label="Send an image"
            title={mediaTitle || 'Send an image'}
          >
            <ImageIcon size={20} aria-hidden="true" />
          </button>
        </div>
      )}

      {recording ? (
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
          className={`${sendClassName} wa-round-btn`}
          onClick={media.startRecording}
          disabled={disabled || mediaBusy}
          aria-label="Record a voice note"
          title="Record a voice note (max 2 min)"
        >
          <Mic size={20} aria-hidden="true" />
        </button>
      )}
    </form>
  );
}

import React, { useRef, useState, useEffect } from 'react';
import { Image as ImageIcon, Mic, X, Square } from 'lucide-react';
import {
  isMediaSupported,
  prepareImage,
  uploadChatMedia,
  startVoiceRecording,
  newMessageId
} from '../services/mediaService';

const formatMs = (ms) => {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const btnStyle = {
  width: '42px',
  height: '42px',
  borderRadius: '50%',
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  border: '1px solid var(--border-color)',
  background: 'var(--bg-input)',
  cursor: 'pointer'
};

/**
 * Attach-image + voice-note controls shared by the random chat and friend DMs (B2-3).
 *
 * Props:
 * - conversationId: current conversation (uploads are namespaced under it)
 * - disabled:       composer is closed (peer left / reconnecting)
 * - onSend:         ({ type, objectUri, localPreviewUrl }) => void, fired after upload
 * - onError:        (message) => void, inline error surfacing (never silent)
 */
export function MediaComposer({ conversationId, disabled, onSend, onError }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const fileInputRef = useRef(null);
  const recorderRef = useRef(null);
  const tickRef = useRef(null);

  useEffect(() => () => {
    // Unmount mid-recording must never leak the mic.
    if (recorderRef.current) recorderRef.current.cancel();
    if (tickRef.current) clearInterval(tickRef.current);
  }, []);

  const configured = isMediaSupported();

  if (!configured) {
    // Firebase web config missing: the controls stay VISIBLE but disabled, with a visible
    // explanation (CONTRACT B2-3: "hide or disable with an explanation" — disabled beats
    // hidden for discoverability). Text chat behaves exactly as it does today.
    return (
      <div id="media-controls-not-configured" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <button
          type="button"
          id="attach-image-btn"
          disabled
          title="Image sharing is disabled: Cloudinary is not configured yet (add VITE_CLOUDINARY_* to .env)"
          style={{ ...btnStyle, opacity: 0.35, cursor: 'not-allowed' }}
        >
          <ImageIcon size={18} color="var(--text-muted)" />
        </button>
        <button
          type="button"
          id="voice-record-btn"
          disabled
          title="Voice notes are disabled: Cloudinary is not configured yet (add VITE_CLOUDINARY_* to .env)"
          style={{ ...btnStyle, opacity: 0.35, cursor: 'not-allowed' }}
        >
          <Mic size={18} color="var(--text-muted)" />
        </button>
      </div>
    );
  }

  const handlePickImage = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !conversationId) return;

    setUploading(true);
    setProgress(0);
    try {
      const { blob } = await prepareImage(file);
      const messageId = newMessageId();
      const localPreviewUrl = URL.createObjectURL(blob);
      const objectUri = await uploadChatMedia(blob, conversationId, messageId, { onProgress: setProgress });
      onSend({ type: 'IMAGE', objectUri, localPreviewUrl });
    } catch (err) {
      onError(err?.message || 'Image upload failed.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleStartRecording = async () => {
    if (!conversationId) return;
    try {
      const controller = await startVoiceRecording();
      recorderRef.current = controller;
      setRecording(true);
      setElapsed(0);
      tickRef.current = setInterval(() => setElapsed(controller.elapsedMs()), 200);
    } catch (err) {
      if (err?.name === 'NotAllowedError' || /denied|permission/i.test(err?.message || '')) {
        onError('Microphone permission was denied. Allow mic access to record voice notes.');
      } else {
        onError(err?.message || 'Voice recording is unavailable.');
      }
    }
  };

  const handleStopRecording = async () => {
    const controller = recorderRef.current;
    if (!controller) return;
    recorderRef.current = null;
    if (tickRef.current) clearInterval(tickRef.current);
    setRecording(false);

    setUploading(true);
    setProgress(0);
    try {
      const { blob } = await controller.stop();
      const messageId = newMessageId();
      const objectUri = await uploadChatMedia(blob, conversationId, messageId, { onProgress: setProgress });
      onSend({ type: 'AUDIO', objectUri, localPreviewUrl: null });
    } catch (err) {
      if (err?.message !== 'cancelled') {
        onError(err?.message || 'Voice note upload failed.');
      }
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleCancelRecording = () => {
    const controller = recorderRef.current;
    recorderRef.current = null;
    if (tickRef.current) clearInterval(tickRef.current);
    setRecording(false);
    controller?.cancel();
  };

  const busy = uploading || recording;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
      {uploading && (
        <span id="media-upload-progress" style={{ fontSize: '0.75rem', color: 'var(--cyan-accent)', whiteSpace: 'nowrap' }}>
          {progress}%
        </span>
      )}

      {recording ? (
        <>
          <span id="voice-recording-timer" style={{
            fontSize: '0.82rem', color: '#ef4444', fontWeight: 700, whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444',
              display: 'inline-block'
            }} />
            {formatMs(elapsed)}
          </span>
          {/* Cancel affordance: discard before sending */}
          <button
            type="button"
            id="voice-cancel-btn"
            onClick={handleCancelRecording}
            disabled={disabled}
            style={{ ...btnStyle, cursor: 'pointer' }}
            title="Discard recording"
          >
            <X size={18} color="#ef4444" />
          </button>
          <button
            type="button"
            id="voice-stop-btn"
            onClick={handleStopRecording}
            disabled={disabled}
            style={{ ...btnStyle, cursor: 'pointer', borderColor: '#ef4444' }}
            title="Send voice note"
          >
            <Square size={16} color="#ef4444" fill="#ef4444" />
          </button>
        </>
      ) : (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <button
            type="button"
            id="attach-image-btn"
            onClick={handlePickImage}
            disabled={disabled || busy}
            style={{ ...btnStyle, opacity: (disabled || busy) ? 0.5 : 1, cursor: (disabled || busy) ? 'not-allowed' : 'pointer' }}
            title="Send an image"
          >
            <ImageIcon size={18} color="var(--cyan-accent)" />
          </button>
          <button
            type="button"
            id="voice-record-btn"
            onClick={handleStartRecording}
            disabled={disabled || busy}
            style={{ ...btnStyle, opacity: (disabled || busy) ? 0.5 : 1, cursor: (disabled || busy) ? 'not-allowed' : 'pointer' }}
            title="Record a voice note (max 2 min)"
          >
            <Mic size={18} color="#a5b4fc" />
          </button>
        </>
      )}
    </div>
  );
}

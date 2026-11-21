import { useRef, useState, useEffect, useCallback } from 'react';
import {
  isMediaSupported,
  prepareImage,
  uploadChatMedia,
  startVoiceRecording,
  newMessageId
} from '../services/mediaService';
import { newClientMessageId } from '../services/socketService';

export const formatMs = (ms) => {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** Android's file picker no longer offers the camera, so it gets its own button there. */
export const hasSeparateCameraPicker = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');

/**
 * Image + voice-note sending shared by the random chat and friend DMs (B2-3): upload state,
 * the hidden file pickers (gallery + camera) and the recorder. The composer decides where the
 * buttons go. A picked photo is not sent straight away: it lands in `pickedFile` for the photo
 * editor, which calls `sendImage` with the final picture, caption and view-once choice.
 *
 * Sending is WhatsApp style: the chat gets the bubble straight away (onPending, shown with a
 * clock) and the upload runs in the background, so the composer is never blocked.
 *
 * - conversationId: current conversation (uploads are namespaced under it)
 * - onPending:      ({ clientMessageId, type, localPreviewUrl, caption?, viewOnce? }) => void, instantly
 * - onSend:         ({ clientMessageId, type, objectUri, localPreviewUrl, caption?, viewOnce? }) => void, after upload
 * - onFailed:       (clientMessageId, message) => void, the background upload failed
 * - onError:        (message) => void, inline error surfacing (never silent)
 */
export function useMediaComposer({ conversationId, onPending, onSend, onFailed, onError }) {
  // Number of photos / voice notes still uploading in the background.
  const [uploading, setUploading] = useState(0);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [micStream, setMicStream] = useState(null);
  const [pickedFile, setPickedFile] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const recorderRef = useRef(null);
  const tickRef = useRef(null);
  const onSendRef = useRef(onSend);
  const onErrorRef = useRef(onError);
  const onPendingRef = useRef(onPending);
  const onFailedRef = useRef(onFailed);
  onSendRef.current = onSend;
  onErrorRef.current = onError;
  onPendingRef.current = onPending;
  onFailedRef.current = onFailed;

  useEffect(() => () => {
    // Unmount mid-recording must never leak the mic.
    if (recorderRef.current) recorderRef.current.cancel();
    if (tickRef.current) clearInterval(tickRef.current);
  }, []);

  const configured = isMediaSupported();

  const pickImage = useCallback(() => fileInputRef.current?.click(), []);
  const pickCamera = useCallback(() => cameraInputRef.current?.click(), []);

  const onFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !conversationId) return;
    if (file.type && !file.type.startsWith('image/')) {
      onErrorRef.current?.('That file is not a photo.');
      return;
    }
    setPickedFile(file);
  }, [conversationId]);

  const clearPicked = useCallback(() => setPickedFile(null), []);

  /**
   * Background upload of one already-shown media bubble. Counts toward `uploading` (used only
   * for a quiet indicator) but never blocks the composer.
   */
  const uploadInBackground = useCallback(async (clientMessageId, prepare, meta) => {
    setUploading(n => n + 1);
    try {
      const blob = await prepare();
      const objectUri = await uploadChatMedia(blob, conversationId, newMessageId());
      onSendRef.current?.({ ...meta, clientMessageId, objectUri });
    } catch (err) {
      const message = err?.message || (meta.type === 'IMAGE' ? 'Photo upload failed.' : 'Voice note upload failed.');
      if (onFailedRef.current) onFailedRef.current(clientMessageId, message);
      onErrorRef.current?.(message);
    } finally {
      setUploading(n => Math.max(0, n - 1));
    }
  }, [conversationId]);

  /**
   * Sends the edited photo: the bubble shows at once (from the local file) and the editor
   * closes; compression + upload continue in the background. Resolves true.
   */
  const sendImage = useCallback(async (image, { caption = '', viewOnce = false } = {}) => {
    if (!image || !conversationId) return false;
    const clientMessageId = newClientMessageId();
    const localPreviewUrl = URL.createObjectURL(image);
    const meta = { type: 'IMAGE', localPreviewUrl, caption: caption.trim(), viewOnce: Boolean(viewOnce) };
    onPendingRef.current?.({ ...meta, clientMessageId });
    setPickedFile(null);
    uploadInBackground(clientMessageId, async () => (await prepareImage(image)).blob, meta);
    return true;
  }, [conversationId, uploadInBackground]);

  const startRecording = useCallback(async () => {
    if (!conversationId || recorderRef.current) return false;
    try {
      const controller = await startVoiceRecording();
      recorderRef.current = controller;
      setMicStream(controller.stream || null);
      setRecording(true);
      setElapsed(0);
      tickRef.current = setInterval(() => setElapsed(controller.elapsedMs()), 200);
      return true;
    } catch (err) {
      if (err?.name === 'NotAllowedError' || /denied|permission/i.test(err?.message || '')) {
        onErrorRef.current?.('Microphone permission was denied. Allow mic access to record voice notes.');
      } else {
        onErrorRef.current?.(err?.message || 'Voice recording is unavailable.');
      }
      return false;
    }
  }, [conversationId]);

  const stopRecording = useCallback(async () => {
    const controller = recorderRef.current;
    if (!controller) return;
    recorderRef.current = null;
    if (tickRef.current) clearInterval(tickRef.current);
    setRecording(false);
    setMicStream(null);

    let blob;
    try {
      ({ blob } = await controller.stop());
    } catch (err) {
      if (err?.message !== 'cancelled') onErrorRef.current?.(err?.message || 'Voice note failed.');
      return;
    }
    // The note is playable right away from the local recording while it uploads.
    const clientMessageId = newClientMessageId();
    const meta = { type: 'AUDIO', localPreviewUrl: URL.createObjectURL(blob) };
    onPendingRef.current?.({ ...meta, clientMessageId });
    uploadInBackground(clientMessageId, async () => blob, meta);
  }, [uploadInBackground]);

  const cancelRecording = useCallback(() => {
    const controller = recorderRef.current;
    recorderRef.current = null;
    if (tickRef.current) clearInterval(tickRef.current);
    setRecording(false);
    setMicStream(null);
    controller?.cancel();
  }, []);

  return {
    configured,
    uploading: uploading > 0,
    recording,
    elapsed,
    micStream,
    fileInputRef,
    cameraInputRef,
    pickImage,
    pickCamera,
    onFileChange,
    pickedFile,
    clearPicked,
    sendImage,
    startRecording,
    stopRecording,
    cancelRecording
  };
}

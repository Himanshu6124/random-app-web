import { useRef, useState, useEffect, useCallback } from 'react';
import {
  isMediaSupported,
  prepareImage,
  uploadChatMedia,
  startVoiceRecording,
  newMessageId
} from '../services/mediaService';

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
 * - conversationId: current conversation (uploads are namespaced under it)
 * - onSend:         ({ type, objectUri, localPreviewUrl, caption?, viewOnce? }) => void, after upload
 * - onError:        (message) => void, inline error surfacing (never silent)
 */
export function useMediaComposer({ conversationId, onSend, onError }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
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
  onSendRef.current = onSend;
  onErrorRef.current = onError;

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
   * Uploads the edited photo and sends it. Resolves true when sent; on failure the error is
   * reported through onError and it resolves false (the editor stays open to retry).
   */
  const sendImage = useCallback(async (image, { caption = '', viewOnce = false } = {}) => {
    if (!image || !conversationId) return false;
    setUploading(true);
    setProgress(0);
    try {
      const { blob } = await prepareImage(image);
      const messageId = newMessageId();
      const localPreviewUrl = URL.createObjectURL(blob);
      const objectUri = await uploadChatMedia(blob, conversationId, messageId, { onProgress: setProgress });
      onSendRef.current?.({ type: 'IMAGE', objectUri, localPreviewUrl, caption: caption.trim(), viewOnce: Boolean(viewOnce) });
      setPickedFile(null);
      return true;
    } catch (err) {
      onErrorRef.current?.(err?.message || 'Image upload failed.');
      return false;
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, [conversationId]);

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

    setUploading(true);
    setProgress(0);
    try {
      const { blob } = await controller.stop();
      const messageId = newMessageId();
      const objectUri = await uploadChatMedia(blob, conversationId, messageId, { onProgress: setProgress });
      onSendRef.current?.({ type: 'AUDIO', objectUri, localPreviewUrl: null });
    } catch (err) {
      if (err?.message !== 'cancelled') {
        onErrorRef.current?.(err?.message || 'Voice note upload failed.');
      }
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, [conversationId]);

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
    uploading,
    progress,
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

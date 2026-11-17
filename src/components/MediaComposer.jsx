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

/**
 * Image + voice-note sending shared by the random chat and friend DMs (B2-3): upload state,
 * the hidden file picker and the recorder. The composer decides where the buttons go.
 *
 * - conversationId: current conversation (uploads are namespaced under it)
 * - onSend:         ({ type, objectUri, localPreviewUrl }) => void, fired after upload
 * - onError:        (message) => void, inline error surfacing (never silent)
 */
export function useMediaComposer({ conversationId, onSend, onError }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [micStream, setMicStream] = useState(null);
  const fileInputRef = useRef(null);
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

  const onFileChange = useCallback(async (e) => {
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
      onSendRef.current?.({ type: 'IMAGE', objectUri, localPreviewUrl });
    } catch (err) {
      onErrorRef.current?.(err?.message || 'Image upload failed.');
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
    pickImage,
    onFileChange,
    startRecording,
    stopRecording,
    cancelRecording
  };
}

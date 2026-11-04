/**
 * Client-side media pipeline for chat (CONTRACT B2). Images and voice notes go from the
 * sender's browser straight to Firebase Storage — never relayed through the backend.
 *
 * Object path: chat-media/{conversationId}/{messageId}.{ext}
 * The messageId is generated here (crypto.randomUUID()) and the caller sends the SAME id
 * with the chat message so object and message correspond.
 *
 * Limits (mirrored server-side):
 * - images: jpeg/png/webp/gif, downscaled to max 1920px on the long edge (GIF skipped to
 *   preserve animation), hard cap 5 MB after processing
 * - voice notes: max 2 minutes, hard cap 5 MB, codec = best MediaRecorder supports
 *   (webm/opus first, mp4/aac fallback for Safari) — never assume webm
 */
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_PRESET;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_VOICE_BYTES = 5 * 1024 * 1024;
export const MAX_VOICE_MS = 2 * 60 * 1000;
export const MAX_IMAGE_EDGE_PX = 1920;

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** True when media can be used at all (Cloudinary config present). */
export function isMediaSupported() {
  return Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_PRESET);
}

function extensionFor(blob) {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav'
  };
  return map[blob.type] || (blob.type.startsWith('image/') ? 'img' : 'aud');
}

export function newMessageId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return 'm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}

function readAsImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This file is not a readable image.')); };
    img.src = url;
  });
}

/**
 * Validates and normalizes an image file. Returns { blob, width, height }.
 * Rejects non-images and anything over the cap AFTER processing (never silently drops).
 */
export async function prepareImage(file) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Unsupported image type. Use JPEG, PNG, WebP or GIF.');
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new Error('Image is too large to process (max 25 MB before optimization).');
  }

  // GIFs are passed through untouched so the animation survives.
  if (file.type === 'image/gif') {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error('Animated GIF is too large (max 5 MB).');
    }
    return { blob: file };
  }

  const img = await readAsImage(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE_PX / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not process this image.');
  ctx.drawImage(img, 0, 0, width, height);

  // PNG keeps transparency; everything else becomes JPEG at high quality (much smaller).
  const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, outType, 0.9));
  if (!blob) throw new Error('Your browser could not process this image.');
  if (blob.size > MAX_IMAGE_BYTES) {
    throw new Error('Image is still too large after optimization (max 5 MB).');
  }
  return { blob, width, height };
}

/**
 * Starts a voice recording. Returns a controller:
 *   { stop() -> Promise<{ blob, durationMs }>, cancel(), elapsedMs(), maxMs }
 * Rejects when mic permission is denied or MediaRecorder is unavailable.
 */
export function startVoiceRecording() {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    return Promise.reject(new Error('Voice recording is not supported in this browser.'));
  }

  return navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
    const mimeCandidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/mpeg',
      'audio/ogg;codecs=opus'
    ];
    const mimeType = mimeCandidates.find(t => {
      try { return MediaRecorder.isTypeSupported(t); } catch { return false; }
    });

    let recorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch (e) {
      stream.getTracks().forEach(t => t.stop());
      throw new Error('Voice recording could not start in this browser.');
    }

    const chunks = [];
    const startedAt = Date.now();
    let cancelled = false;
    let capTimer = null;
    let settled = false;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const cleanup = () => {
      if (capTimer) clearTimeout(capTimer);
      stream.getTracks().forEach(t => t.stop());
    };

    // Hard 2-minute cap: auto-stop at MAX_VOICE_MS.
    capTimer = setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, MAX_VOICE_MS);

    const stopped = new Promise((resolve, reject) => {
      recorder.onstop = () => {
        if (settled) return;
        settled = true;
        cleanup();
        if (cancelled) {
          reject(new Error('cancelled'));
          return;
        }
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size > MAX_VOICE_BYTES) {
          reject(new Error('Voice note is too large (max 5 MB). Try a shorter recording.'));
          return;
        }
        resolve({ blob, durationMs: Math.min(Date.now() - startedAt, MAX_VOICE_MS) });
      };
      recorder.onerror = () => {
        if (settled) return;
        settled = true;
        cancelled = true;
        cleanup();
        reject(new Error('Recording failed. Please try again.'));
      };
    });

    recorder.start(250);

    return {
      stop: () => {
        if (recorder.state !== 'inactive') recorder.stop();
        return stopped;
      },
      cancel: () => {
        cancelled = true;
        if (recorder.state !== 'inactive') recorder.stop();
        return stopped.catch(() => {});
      },
      elapsedMs: () => Date.now() - startedAt,
      maxMs: MAX_VOICE_MS
    };
  });
}

/**
 * Uploads media straight to Cloudinary using unsigned upload preset:
 *   chat-media/{conversationId}/{messageId}.{ext}
 * Returns the public secure download URL. onProgress receives 0..100.
 */
export function uploadChatMedia(blob, conversationId, messageId, { onProgress } = {}) {
  const cloudName = CLOUDINARY_CLOUD_NAME || import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = CLOUDINARY_PRESET || import.meta.env.VITE_CLOUDINARY_PRESET;

  if (!cloudName || !uploadPreset) {
    return Promise.reject(new Error('Media uploads are not configured yet (missing Cloudinary configuration).'));
  }

  const ext = extensionFor(blob);
  const publicId = `chat-media/${conversationId}/${messageId}`;
  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

  const formData = new FormData();
  formData.append('file', blob, `${messageId}.${ext}`);
  formData.append('upload_preset', uploadPreset);
  formData.append('public_id', publicId);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl);

    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data.secure_url || data.url);
        } catch (err) {
          reject(new Error('Invalid response received from Cloudinary.'));
        }
      } else {
        let errorMsg = `Upload failed (${xhr.status}): ${xhr.statusText}`;
        try {
          const errData = JSON.parse(xhr.responseText);
          if (errData?.error?.message) {
            errorMsg = errData.error.message;
          }
        } catch {}
        reject(new Error(errorMsg));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload to Cloudinary.'));
    xhr.send(formData);
  });
}

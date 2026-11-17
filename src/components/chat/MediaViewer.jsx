import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Portal } from '../Portal';

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const STEP = 1.5;
const DOUBLE_TAP_MS = 280;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Full-screen image viewer.
 *  - Phones: pinch to zoom, drag to pan, double-tap to zoom in/out.
 *  - Desktop: + / − buttons (and keys), mouse wheel zooms at the cursor, drag to pan,
 *    double-click toggles zoom.
 * Rendered in a portal: a chat bubble has a transform, which would otherwise trap a
 * "position: fixed" overlay inside the bubble.
 */
export function MediaViewer({ src, alt, onClose }) {
  const stageRef = useRef(null);
  const imgRef = useRef(null);
  const view = useRef({ s: 1, x: 0, y: 0 });
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const lastTap = useRef({ t: 0, x: 0, y: 0 });
  const moved = useRef(false);
  const downOnImage = useRef(false);
  const [scale, setScale] = useState(1);
  const [animate, setAnimate] = useState(false);

  const apply = useCallback((next, smooth = false) => {
    const stage = stageRef.current;
    const img = imgRef.current;
    if (!stage || !img) return;
    const s = clamp(next.s, MIN_SCALE, MAX_SCALE);
    // Keep the image covering the stage when it is larger than it; centred otherwise.
    const maxX = Math.max(0, (img.offsetWidth * s - stage.clientWidth) / 2);
    const maxY = Math.max(0, (img.offsetHeight * s - stage.clientHeight) / 2);
    const v = { s, x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) };
    view.current = v;
    setAnimate(smooth);
    img.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.s})`;
    setScale(v.s);
  }, []);

  /** Point relative to the stage centre. */
  const toStage = useCallback((clientX, clientY) => {
    const r = stageRef.current.getBoundingClientRect();
    return { x: clientX - (r.left + r.width / 2), y: clientY - (r.top + r.height / 2) };
  }, []);

  /** Zoom to `s`, keeping stage point `p` fixed under the finger / cursor. */
  const zoomAt = useCallback((s, p = { x: 0, y: 0 }, smooth = true) => {
    const cur = view.current;
    const ns = clamp(s, MIN_SCALE, MAX_SCALE);
    const k = ns / cur.s;
    apply({ s: ns, x: p.x - k * (p.x - cur.x), y: p.y - k * (p.y - cur.y) }, smooth);
  }, [apply]);

  const reset = useCallback(() => apply({ s: 1, x: 0, y: 0 }, true), [apply]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === '+' || e.key === '=') zoomAt(view.current.s * STEP);
      else if (e.key === '-' || e.key === '_') zoomAt(view.current.s / STEP);
      else if (e.key === '0') reset();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, zoomAt, reset]);

  // Wheel must be non-passive to stop the page from scrolling.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025));
      zoomAt(view.current.s * factor, toStage(e.clientX, e.clientY), false);
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [zoomAt, toStage]);

  const startGesture = () => {
    const pts = [...pointers.current.values()];
    const v = { ...view.current };
    if (pts.length >= 2) {
      const [a, b] = pts;
      const mid = toStage((a.x + b.x) / 2, (a.y + b.y) / 2);
      gesture.current = { type: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid, v };
    } else if (pts.length === 1) {
      gesture.current = { type: 'pan', start: pts[0], v };
    } else {
      gesture.current = null;
    }
  };

  const onPointerDown = (e) => {
    if (e.target.closest('.mv-toolbar')) return;
    try { stageRef.current.setPointerCapture?.(e.pointerId); } catch { /* not capturable */ }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      moved.current = false;
      downOnImage.current = e.target === imgRef.current;
    }
    startGesture();
  };

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    if (g.type === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = toStage((a.x + b.x) / 2, (a.y + b.y) / 2);
      const s = clamp(g.v.s * (dist / g.dist), MIN_SCALE, MAX_SCALE);
      // Image point that was under the fingers stays under the (moving) fingers.
      const ux = (g.mid.x - g.v.x) / g.v.s;
      const uy = (g.mid.y - g.v.y) / g.v.s;
      moved.current = true;
      apply({ s, x: mid.x - s * ux, y: mid.y - s * uy });
    } else if (g.type === 'pan') {
      const dx = e.clientX - g.start.x;
      const dy = e.clientY - g.start.y;
      if (Math.hypot(dx, dy) > 4) moved.current = true;
      if (g.v.s > 1) apply({ s: g.v.s, x: g.v.x + dx, y: g.v.y + dy });
    }
  };

  const onPointerUp = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const wasTap = !moved.current && pointers.current.size === 0;
    startGesture();
    if (!wasTap) return;

    const now = Date.now();
    const p = toStage(e.clientX, e.clientY);
    const last = lastTap.current;
    if (now - last.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 30) {
      lastTap.current = { t: 0, x: 0, y: 0 };
      if (view.current.s > 1.05) reset();
      else zoomAt(2.5, p);
      return;
    }
    lastTap.current = { t: now, x: e.clientX, y: e.clientY };
    // A single tap on the dark area (not the photo) closes the viewer when not zoomed.
    if (!downOnImage.current && view.current.s <= 1.01) {
      setTimeout(() => {
        if (lastTap.current.t === now) onClose();
      }, DOUBLE_TAP_MS);
    }
  };

  const pct = Math.round(scale * 100);

  return (
    <Portal>
      <div className="mv-overlay" role="dialog" aria-modal="true" aria-label="Image viewer">
        <div
          ref={stageRef}
          className={`mv-stage${scale > 1 ? ' is-zoomed' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            draggable={false}
            className={`mv-img${animate ? ' is-animating' : ''}`}
          />
        </div>

        <button type="button" className="mv-close" onClick={onClose} aria-label="Close image">
          <X size={22} aria-hidden="true" />
        </button>

        <div className="mv-toolbar" role="toolbar" aria-label="Zoom">
          <button type="button" onClick={() => zoomAt(view.current.s / STEP)} disabled={scale <= MIN_SCALE} aria-label="Zoom out">
            <ZoomOut size={18} aria-hidden="true" />
          </button>
          <button type="button" className="mv-toolbar__pct" onClick={reset} disabled={scale <= MIN_SCALE} aria-label="Reset zoom">
            {pct === 100 ? '100%' : <><RotateCcw size={13} aria-hidden="true" />{pct}%</>}
          </button>
          <button type="button" onClick={() => zoomAt(view.current.s * STEP)} disabled={scale >= MAX_SCALE} aria-label="Zoom in">
            <ZoomIn size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </Portal>
  );
}

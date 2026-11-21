import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X, Crop, Smile, Type, Pencil, Undo2, RotateCw, Send, Check, Square, Trash2 } from 'lucide-react';
import { Portal } from '../Portal';
import { ViewOnceIcon } from './ViewOnceBubble';
import { decodeImage } from '../../services/mediaService';
import { MAX_MESSAGE_LENGTH } from '../../services/socketService';
import { feedback } from '../../mobile/feedback';
import '../../styles/photoEditor.css';

/**
 * WhatsApp-style "send photo" screen: preview the picked / captured photo, optionally crop &
 * rotate it, draw on it, drop emoji stickers or text on it, add a caption and choose view once.
 *
 * Everything is plain canvas + DOM, no library. Edits are kept as layers (strokes, stickers) in
 * coordinates relative to the picture (0..1), so they survive any screen size; cropping or
 * rotating bakes them into the picture first. An unedited photo is sent as the original file.
 */

const WORK_EDGE = 2048;           // the picture is edited at most this big (the upload is smaller still)
const MIN_CROP = 0.08;            // smallest crop side, relative to the picture
const MAX_BASE_UNDO = 4;          // crop / rotate steps kept for undo (each is a full bitmap)
const COLORS = ['#ffffff', '#111111', '#ff375f', '#ff9f0a', '#ffd60a', '#30d158', '#0a84ff', '#bf5af2'];
const EMOJIS = [
  '😂', '😍', '🥰', '😎', '🤩', '😜', '🥺', '😭', '😡', '🤯', '😴', '🤡',
  '❤️', '💔', '🔥', '✨', '💯', '⭐', '🌈', '☀️', '🌙', '⚡', '💥', '💫',
  '👍', '👏', '🙌', '🤞', '✌️', '🤙', '💪', '👀', '💋', '🎉', '🎂', '🎁',
  '🍕', '🍔', '☕', '🍿', '🍦', '🍓', '🐶', '🐱', '🦋', '🌸', '🌴', '🏖️',
  '😇', '🤔', '🙈', '💀', '👻', '🤖', '👑', '🕶️', '🎧', '🎮', '⚽', '🏆'
];
const TEXT_FONT = '700 {px}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const EMOJI_FONT = '{px}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
let nextId = 1;
const uid = () => `l${nextId++}`;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function rotateCanvas(src) {
  const out = makeCanvas(src.height, src.width);
  const ctx = out.getContext('2d');
  ctx.translate(out.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(src, 0, 0);
  return out;
}

function cropCanvas(src, r) {
  const sx = Math.round(r.x * src.width);
  const sy = Math.round(r.y * src.height);
  const sw = Math.max(1, Math.round(r.w * src.width));
  const sh = Math.max(1, Math.round(r.h * src.height));
  const out = makeCanvas(sw, sh);
  out.getContext('2d').drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}

/** Draws strokes and stickers onto a context that is w × h pixels (the picture's own box). */
function paintLayers(ctx, w, h, strokes, items) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    if (!s.points.length) continue;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width * w;
    ctx.beginPath();
    const [x0, y0] = s.points[0];
    ctx.moveTo(x0 * w, y0 * h);
    if (s.points.length === 1) ctx.lineTo(x0 * w + 0.01, y0 * h);
    for (let i = 1; i < s.points.length; i += 1) ctx.lineTo(s.points[i][0] * w, s.points[i][1] * h);
    ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const it of items) {
    const px = it.size * w;
    if (it.kind === 'emoji') {
      ctx.font = EMOJI_FONT.replace('{px}', px.toFixed(1));
      ctx.shadowColor = 'transparent';
      ctx.fillText(it.value, it.x * w, it.y * h);
    } else {
      ctx.font = TEXT_FONT.replace('{px}', px.toFixed(1));
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = px * 0.18;
      ctx.shadowOffsetY = px * 0.04;
      ctx.fillStyle = it.color;
      ctx.fillText(it.value, it.x * w, it.y * h);
      ctx.shadowColor = 'transparent';
    }
  }
  ctx.restore();
}

/** The picture with every layer baked in, at full editing resolution. */
function flatten(base, strokes, items) {
  const out = makeCanvas(base.width, base.height);
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#ffffff'; // sent as JPEG: transparent pixels must not turn black
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(base, 0, 0);
  paintLayers(ctx, out.width, out.height, strokes, items);
  return out;
}

const toBlob = (canvas) => new Promise((resolve, reject) => {
  canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not prepare the photo.'))), 'image/jpeg', 0.92);
});

/** Crop frame with four corner handles; the frame itself can be dragged. Works in 0..1 units. */
function CropFrame({ rect, onChange, aspect }) {
  const boxRef = useRef(null);
  const drag = useRef(null);

  const start = (e, handle) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const box = boxRef.current.getBoundingClientRect();
    drag.current = { handle, x0: e.clientX, y0: e.clientY, r0: rect, bw: box.width, bh: box.height };
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.x0) / d.bw;
    const dy = (e.clientY - d.y0) / d.bh;
    const r = d.r0;
    if (d.handle === 'move') {
      onChange({ ...r, x: clamp(r.x + dx, 0, 1 - r.w), y: clamp(r.y + dy, 0, 1 - r.h) });
      return;
    }
    let left = r.x;
    let top = r.y;
    let right = r.x + r.w;
    let bottom = r.y + r.h;
    if (d.handle.includes('w')) left = clamp(left + dx, 0, right - MIN_CROP);
    if (d.handle.includes('e')) right = clamp(right + dx, left + MIN_CROP, 1);
    if (d.handle.includes('n')) top = clamp(top + dy, 0, bottom - MIN_CROP);
    if (d.handle.includes('s')) bottom = clamp(bottom + dy, top + MIN_CROP, 1);
    if (aspect) {
      // Keep the frame square on screen: height follows width (in the picture's own units).
      const ratio = d.bw / d.bh;
      let w = right - left;
      let h = w * ratio;
      const maxH = d.handle.includes('n') ? bottom : 1 - top;
      if (h > maxH) { h = maxH; w = h / ratio; }
      if (d.handle.includes('w')) left = right - w; else right = left + w;
      if (d.handle.includes('n')) top = bottom - h; else bottom = top + h;
    }
    onChange({ x: left, y: top, w: right - left, h: bottom - top });
  };
  const end = () => { drag.current = null; };

  const pct = (v) => `${(v * 100).toFixed(3)}%`;
  return (
    <div ref={boxRef} className="pe-crop" onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <div className="pe-crop__shade" style={{ left: 0, top: 0, right: 0, height: pct(rect.y) }} />
      <div className="pe-crop__shade" style={{ left: 0, top: pct(rect.y + rect.h), right: 0, bottom: 0 }} />
      <div className="pe-crop__shade" style={{ left: 0, top: pct(rect.y), width: pct(rect.x), height: pct(rect.h) }} />
      <div className="pe-crop__shade" style={{ left: pct(rect.x + rect.w), top: pct(rect.y), right: 0, height: pct(rect.h) }} />
      <div
        className="pe-crop__frame"
        style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) }}
        onPointerDown={(e) => start(e, 'move')}
      >
        <span className="pe-crop__grid" aria-hidden="true" />
        {['nw', 'ne', 'sw', 'se'].map(h => (
          <span
            key={h}
            className={`pe-crop__handle pe-crop__handle--${h}`}
            onPointerDown={(e) => start(e, h)}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}

export function PhotoEditor({ file, onCancel, onSend, uploading = false, progress = 0, peerName = '' }) {
  const [base, setBase] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [strokes, setStrokes] = useState([]);
  const [items, setItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [baseChanged, setBaseChanged] = useState(false);
  const [mode, setMode] = useState('view');       // view | draw | crop | emoji | text
  const [color, setColor] = useState(COLORS[2]);
  const [caption, setCaption] = useState('');
  const [viewOnce, setViewOnce] = useState(false);
  const [toast, setToast] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [overTrash, setOverTrash] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 1, h: 1 });
  const [square, setSquare] = useState(false);
  const [textDraft, setTextDraft] = useState('');
  const [sendError, setSendError] = useState('');
  const [box, setBox] = useState({ w: 0, h: 0 });   // the picture's size on screen

  const stageRef = useRef(null);
  const viewRef = useRef(null);
  const inkRef = useRef(null);
  const trashRef = useRef(null);
  const liveStroke = useRef(null);
  const gesture = useRef({ pointers: new Map() });
  const toastTimer = useRef(null);

  const edited = baseChanged || strokes.length > 0 || items.length > 0;

  // Decode the photo once, scaled down to a comfortable editing size.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const decoded = await decodeImage(file);
        const scale = Math.min(1, WORK_EDGE / Math.max(decoded.width, decoded.height));
        const c = makeCanvas(decoded.width * scale, decoded.height * scale);
        const ctx = c.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(decoded.source, 0, 0, c.width, c.height);
        decoded.close();
        if (alive) setBase(c);
      } catch (e) {
        if (alive) setLoadError(e?.message || 'This photo could not be opened.');
      }
    })();
    return () => { alive = false; };
  }, [file]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Escape closes the open tool first, then the editor.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (mode !== 'view') setMode('view');
      else if (!uploading) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, onCancel, uploading]);

  // Fit the picture inside the stage.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || !base) return undefined;
    const fit = () => {
      const sw = stage.clientWidth;
      const sh = stage.clientHeight;
      if (!sw || !sh) return;
      const s = Math.min(sw / base.width, sh / base.height);
      setBox({ w: Math.floor(base.width * s), h: Math.floor(base.height * s) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [base]);

  // Paint the picture.
  useEffect(() => {
    const c = viewRef.current;
    if (!c || !base) return;
    c.width = base.width;
    c.height = base.height;
    c.getContext('2d').drawImage(base, 0, 0);
  }, [base]);

  // Paint the strokes (sharp on high-DPI screens).
  const paintInk = useCallback(() => {
    const c = inkRef.current;
    if (!c || !box.w) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (c.width !== Math.round(box.w * dpr)) {
      c.width = Math.round(box.w * dpr);
      c.height = Math.round(box.h * dpr);
    }
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.scale(dpr, dpr);
    const all = liveStroke.current ? [...strokes, liveStroke.current] : strokes;
    paintLayers(ctx, box.w, box.h, all, []);
  }, [strokes, box]);
  useEffect(() => { paintInk(); }, [paintInk]);

  const flash = (text) => {
    clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = setTimeout(() => setToast(''), 1800);
  };

  const pushHistory = (entry) => {
    setHistory(prev => {
      let next = [...prev, entry];
      const baseEntries = next.filter(h => h.kind === 'base');
      if (baseEntries.length > MAX_BASE_UNDO) next = next.filter(h => h !== baseEntries[0]);
      return next;
    });
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    feedback('tap');
    setHistory(history.slice(0, -1));
    if (last.kind === 'stroke') setStrokes(s => s.slice(0, -1));
    else if (last.kind === 'item') setItems(list => list.filter(i => i.id !== last.id));
    else if (last.kind === 'base') {
      setBase(last.base);
      setStrokes(last.strokes);
      setItems(last.items);
      setBaseChanged(last.baseChanged);
    }
    setSelectedId(null);
  };

  /** Crop / rotate: bake the layers into the picture, replace it, keep the old one for undo. */
  const replaceBase = (next) => {
    pushHistory({ kind: 'base', base, strokes, items, baseChanged });
    setBase(next);
    setStrokes([]);
    setItems([]);
    setSelectedId(null);
    setBaseChanged(true);
  };

  const rotate = () => {
    if (!base) return;
    feedback('tap');
    replaceBase(rotateCanvas(flatten(base, strokes, items)));
    setCrop({ x: 0, y: 0, w: 1, h: 1 });
    setSquare(false);
  };

  const applyCrop = () => {
    const full = crop.x <= 0.001 && crop.y <= 0.001 && crop.w >= 0.999 && crop.h >= 0.999;
    if (!full && base) replaceBase(cropCanvas(flatten(base, strokes, items), crop));
    setMode('view');
  };

  const openCrop = () => {
    setSelectedId(null);
    setCrop({ x: 0, y: 0, w: 1, h: 1 });
    setSquare(false);
    setMode('crop');
  };

  const toggleSquare = () => {
    const next = !square;
    setSquare(next);
    if (next && box.w && box.h) {
      // Largest centred square
      const side = Math.min(box.w, box.h);
      const w = side / box.w;
      const h = side / box.h;
      setCrop({ x: (1 - w) / 2, y: (1 - h) / 2, w, h });
    }
  };

  const addItem = (item) => {
    const id = uid();
    setItems(list => [...list, { id, ...item }]);
    pushHistory({ kind: 'item', id });
    setSelectedId(id);
    feedback('select');
  };

  const addEmoji = (emoji) => {
    addItem({ kind: 'emoji', value: emoji, x: 0.5, y: 0.45, size: 0.18 });
    setMode('view');
  };

  const commitText = () => {
    const value = textDraft.trim();
    if (value) addItem({ kind: 'text', value, x: 0.5, y: 0.4, size: 0.075, color });
    setTextDraft('');
    setMode('view');
  };

  // ---- Pointer handling on the picture: drawing, dragging / pinching stickers ----
  const toLocal = (e) => {
    const r = inkRef.current.getBoundingClientRect();
    return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)];
  };

  const isOverTrash = (e) => {
    const t = trashRef.current?.getBoundingClientRect();
    if (!t) return false;
    return e.clientX >= t.left - 16 && e.clientX <= t.right + 16 && e.clientY >= t.top - 16 && e.clientY <= t.bottom + 16;
  };

  const onLayerDown = (e) => {
    if (mode === 'crop' || !box.w) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const g = gesture.current;

    if (mode === 'draw') {
      if (liveStroke.current) return;
      liveStroke.current = { color, width: 0.011, points: [toLocal(e)] };
      g.drawPointer = e.pointerId;
      paintInk();
      return;
    }

    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.pointers.size === 1) {
      const hit = e.target.closest?.('[data-item-id]')?.dataset.itemId || null;
      setSelectedId(hit);
      g.targetId = hit;
      if (hit) {
        const it = items.find(i => i.id === hit);
        g.start = { x: e.clientX, y: e.clientY, item: it };
        g.moved = false;
      }
    } else if (g.pointers.size === 2 && g.targetId) {
      const [a, b] = [...g.pointers.values()];
      const it = items.find(i => i.id === g.targetId);
      g.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, size: it?.size || 0.1 };
    }
  };

  const onLayerMove = (e) => {
    const g = gesture.current;
    if (mode === 'draw') {
      if (!liveStroke.current || e.pointerId !== g.drawPointer) return;
      liveStroke.current.points.push(toLocal(e));
      paintInk();
      return;
    }
    if (!g.pointers.has(e.pointerId) || !g.targetId) return;
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const id = g.targetId;
    if (g.pointers.size >= 2 && g.pinch) {
      const [a, b] = [...g.pointers.values()];
      const size = clamp(g.pinch.size * (Math.hypot(a.x - b.x, a.y - b.y) / g.pinch.dist), 0.03, 0.8);
      setItems(list => list.map(i => (i.id === id ? { ...i, size } : i)));
      return;
    }
    const s = g.start;
    if (!s?.item) return;
    const dx = (e.clientX - s.x) / box.w;
    const dy = (e.clientY - s.y) / box.h;
    if (!g.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 4) {
      g.moved = true;
      setDragging(true);
    }
    if (!g.moved) return;
    setItems(list => list.map(i => (i.id === id ? { ...i, x: clamp(s.item.x + dx, 0, 1), y: clamp(s.item.y + dy, 0, 1) } : i)));
    setOverTrash(isOverTrash(e));
  };

  const onLayerUp = (e) => {
    const g = gesture.current;
    if (mode === 'draw') {
      if (e.pointerId !== g.drawPointer || !liveStroke.current) return;
      const done = liveStroke.current;
      liveStroke.current = null;
      g.drawPointer = null;
      setStrokes(s => [...s, done]);
      pushHistory({ kind: 'stroke' });
      return;
    }
    g.pointers.delete(e.pointerId);
    if (g.pointers.size < 2) g.pinch = null;
    if (g.pointers.size === 1 && g.targetId) {
      // Pinch ended with one finger still down: continue dragging from here.
      const [p] = [...g.pointers.values()];
      g.start = { x: p.x, y: p.y, item: items.find(i => i.id === g.targetId) };
    }
    if (g.pointers.size === 0) {
      if (g.targetId && g.moved && isOverTrash(e)) {
        const id = g.targetId;
        setItems(list => list.filter(i => i.id !== id));
        setHistory(h => h.filter(x => !(x.kind === 'item' && x.id === id)));
        setSelectedId(null);
        feedback('warning');
      }
      g.targetId = null;
      g.start = null;
      g.moved = false;
      setDragging(false);
      setOverTrash(false);
    }
  };

  const onWheel = (e) => {
    if (!selectedId) return;
    const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    setItems(list => list.map(i => (i.id === selectedId ? { ...i, size: clamp(i.size * factor, 0.03, 0.8) } : i)));
  };

  const removeSelected = () => {
    if (!selectedId) return;
    const id = selectedId;
    setItems(list => list.filter(i => i.id !== id));
    setHistory(h => h.filter(x => !(x.kind === 'item' && x.id === id)));
    setSelectedId(null);
  };

  const toggleViewOnce = () => {
    const next = !viewOnce;
    setViewOnce(next);
    feedback('select');
    flash(next ? 'Photo set to view once' : 'View once turned off');
  };

  const send = async () => {
    if (uploading || !base) return;
    setSendError('');
    feedback('send');
    try {
      const image = edited ? await toBlob(flatten(base, strokes, items)) : file;
      const ok = await onSend({ image, caption: caption.slice(0, MAX_MESSAGE_LENGTH), viewOnce });
      if (ok === false) setSendError("Couldn't send the photo. Try again.");
    } catch (e) {
      setSendError(e?.message || "Couldn't send the photo.");
    }
  };

  const tools = [
    { id: 'crop', icon: Crop, label: 'Crop and rotate', onClick: openCrop },
    { id: 'emoji', icon: Smile, label: 'Stickers', onClick: () => { setSelectedId(null); setMode(m => (m === 'emoji' ? 'view' : 'emoji')); } },
    { id: 'text', icon: Type, label: 'Text', onClick: () => { setSelectedId(null); setTextDraft(''); setMode('text'); } },
    { id: 'draw', icon: Pencil, label: 'Draw', onClick: () => { setSelectedId(null); setMode(m => (m === 'draw' ? 'view' : 'draw')); } }
  ];

  return (
    <Portal>
      <div className="pe" role="dialog" aria-modal="true" aria-label="Send photo">
        {/* Top bar */}
        <div className="pe-top">
          {mode === 'crop' ? (
            <>
              <button type="button" className="pe-btn" onClick={() => setMode('view')} aria-label="Cancel crop">
                <X size={22} aria-hidden="true" />
              </button>
              <span className="pe-top__title">Crop</span>
              <button type="button" className="pe-btn pe-btn--accent" onClick={applyCrop} aria-label="Apply crop">
                <Check size={22} aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <button type="button" className="pe-btn" onClick={onCancel} disabled={uploading} aria-label="Discard photo">
                <X size={22} aria-hidden="true" />
              </button>
              <div className="pe-tools">
                {history.length > 0 && (
                  <button type="button" className="pe-btn" onClick={undo} aria-label="Undo" title="Undo">
                    <Undo2 size={20} aria-hidden="true" />
                  </button>
                )}
                {tools.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className={`pe-btn${mode === t.id ? ' is-on' : ''}`}
                    onClick={t.onClick}
                    disabled={!base || uploading}
                    aria-label={t.label}
                    aria-pressed={mode === t.id}
                    title={t.label}
                    style={t.id === 'draw' && mode === 'draw' ? { color } : undefined}
                  >
                    <t.icon size={21} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Picture */}
        <div className="pe-stage" ref={stageRef}>
          {loadError && <p className="pe-error">{loadError}</p>}
          {!base && !loadError && <div className="pe-spinner" aria-label="Loading photo" />}
          {base && (
            <div className="pe-canvas" style={{ width: box.w, height: box.h }}>
              <canvas ref={viewRef} className="pe-canvas__img" />
              <canvas ref={inkRef} className="pe-canvas__ink" style={{ width: box.w, height: box.h }} />
              <div
                className={`pe-layer${mode === 'draw' ? ' is-drawing' : ''}`}
                onPointerDown={onLayerDown}
                onPointerMove={onLayerMove}
                onPointerUp={onLayerUp}
                onPointerCancel={onLayerUp}
                onWheel={onWheel}
              >
                {items.map(it => (
                  <span
                    key={it.id}
                    data-item-id={it.id}
                    className={`pe-item pe-item--${it.kind}${selectedId === it.id ? ' is-selected' : ''}${dragging && selectedId === it.id && overTrash ? ' is-doomed' : ''}`}
                    style={{
                      left: `${it.x * 100}%`,
                      top: `${it.y * 100}%`,
                      fontSize: `${it.size * box.w}px`,
                      color: it.kind === 'text' ? it.color : undefined
                    }}
                  >
                    {it.value}
                  </span>
                ))}
              </div>
              {mode === 'crop' && <CropFrame rect={crop} onChange={setCrop} aspect={square} />}
            </div>
          )}

          {dragging && (
            <div ref={trashRef} className={`pe-trash${overTrash ? ' is-armed' : ''}`} aria-hidden="true">
              <Trash2 size={20} />
            </div>
          )}

          {mode === 'draw' && (
            <div className="pe-palette" role="radiogroup" aria-label="Pen colour">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={`Colour ${c}`}
                  className={`pe-swatch${color === c ? ' is-on' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          )}

          {selectedId && !dragging && mode === 'view' && (
            <button type="button" className="pe-chip" onClick={removeSelected}>
              <Trash2 size={14} aria-hidden="true" /> Remove
            </button>
          )}

          {toast && <div className="pe-toast" role="status">{toast}</div>}
        </div>

        {/* Bottom: crop controls, emoji sheet, text entry, or the caption bar */}
        {mode === 'crop' ? (
          <div className="pe-cropbar">
            <button type="button" className="pe-btn pe-btn--label" onClick={rotate}>
              <RotateCw size={20} aria-hidden="true" /> Rotate
            </button>
            <button type="button" className={`pe-btn pe-btn--label${square ? ' is-on' : ''}`} onClick={toggleSquare} aria-pressed={square}>
              <Square size={18} aria-hidden="true" /> Square
            </button>
            <button type="button" className="pe-btn pe-btn--label" onClick={() => { setSquare(false); setCrop({ x: 0, y: 0, w: 1, h: 1 }); }}>
              Reset
            </button>
          </div>
        ) : mode === 'emoji' ? (
          <div className="pe-sheet" role="listbox" aria-label="Stickers">
            {EMOJIS.map(em => (
              <button key={em} type="button" className="pe-emoji" onClick={() => addEmoji(em)} aria-label={`Add ${em}`}>
                {em}
              </button>
            ))}
          </div>
        ) : mode === 'text' ? (
          <div className="pe-textbar">
            <div className="pe-palette pe-palette--row" role="radiogroup" aria-label="Text colour">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={`Colour ${c}`}
                  className={`pe-swatch${color === c ? ' is-on' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
            <div className="pe-caption">
              <input
                autoFocus
                type="text"
                value={textDraft}
                maxLength={80}
                onChange={(e) => setTextDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitText(); } }}
                placeholder="Type something…"
                aria-label="Text on the photo"
                style={{ color }}
              />
              <button type="button" className="pe-send" onClick={commitText} aria-label="Add text">
                <Check size={20} aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : (
          <div className="pe-bottom">
            {sendError && <p className="pe-error pe-error--inline" role="alert">{sendError}</p>}
            <div className="pe-caption">
              <input
                type="text"
                value={caption}
                maxLength={MAX_MESSAGE_LENGTH}
                onChange={(e) => setCaption(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }}
                placeholder="Add a caption…"
                aria-label="Caption"
                enterKeyHint="send"
                disabled={uploading}
              />
              <button
                type="button"
                className={`pe-once${viewOnce ? ' is-on' : ''}`}
                onClick={toggleViewOnce}
                disabled={uploading}
                aria-pressed={viewOnce}
                aria-label={viewOnce ? 'View once is on' : 'Send as view once'}
                title={viewOnce ? 'View once is on: it can be opened one time' : 'View once'}
              >
                <ViewOnceIcon size={24} filled={viewOnce} />
              </button>
              <button
                type="button"
                className="pe-send"
                onClick={send}
                disabled={!base || uploading}
                aria-label="Send photo"
              >
                {uploading ? <span className="pe-send__progress">{progress}%</span> : <Send size={20} aria-hidden="true" />}
              </button>
            </div>
            {peerName && <p className="pe-to">To {peerName}</p>}
          </div>
        )}
      </div>
    </Portal>
  );
}

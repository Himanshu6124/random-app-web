import React, { useEffect, useRef } from 'react';

const BAR_W = 3;
const GAP = 2;
const SAMPLE_MS = 70;

/**
 * Live waveform for a voice note being recorded (WhatsApp style): bars scroll in from the
 * right and their height follows the loudness of the microphone.
 */
export function VoiceWaveform({ stream }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !stream) return undefined;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return undefined;

    let ctx;
    let source;
    try {
      ctx = new AudioCtx();
      source = ctx.createMediaStreamSource(stream);
    } catch {
      return undefined;
    }
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 120;
    const cssH = canvas.clientHeight || 28;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const g = canvas.getContext('2d');
    g.scale(dpr, dpr);

    const maxBars = Math.ceil(cssW / (BAR_W + GAP));
    const levels = [];
    const color = getComputedStyle(canvas).color || '#f07289';
    let raf = 0;
    let lastSample = 0;

    const draw = (now) => {
      raf = requestAnimationFrame(draw);
      if (now - lastSample >= SAMPLE_MS) {
        lastSample = now;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        // Speech RMS is small; boost and clamp so normal talking fills most of the height.
        levels.push(Math.min(1, rms * 4.5));
        if (levels.length > maxBars) levels.shift();
      }
      g.clearRect(0, 0, cssW, cssH);
      g.fillStyle = color;
      const mid = cssH / 2;
      for (let i = 0; i < levels.length; i++) {
        const x = cssW - (levels.length - i) * (BAR_W + GAP);
        const h = Math.max(3, levels[i] * (cssH - 2));
        const r = BAR_W / 2;
        g.beginPath();
        if (g.roundRect) g.roundRect(x, mid - h / 2, BAR_W, h, r);
        else g.rect(x, mid - h / 2, BAR_W, h);
        g.fill();
      }
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      try { source.disconnect(); } catch { /* already gone */ }
      ctx.close?.().catch?.(() => {});
    };
  }, [stream]);

  return <canvas ref={canvasRef} className="voice-waveform" aria-hidden="true" />;
}

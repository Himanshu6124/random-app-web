import React, { useEffect, useRef } from 'react';
import {
  Chart, LineController, LineElement, PointElement, BarController, BarElement,
  CategoryScale, LinearScale, Tooltip, Legend, Filler,
} from 'chart.js';

Chart.register(LineController, LineElement, PointElement, BarController, BarElement,
  CategoryScale, LinearScale, Tooltip, Legend, Filler);

/**
 * Categorical order, validated for the dark plum surface (#21141f): lightness band, chroma,
 * adjacent CVD separation and contrast all pass. Assign in this order, never cycled.
 */
export const SERIES = ['#e0607a', '#5f88dc', '#a8832f', '#9a76db', '#2f9e6d'];
const INK = '#c9b6bf';
const MUTED = '#a8939e';
const GRID = 'rgba(201, 182, 191, 0.10)';
const SURFACE = '#21141f';

Chart.defaults.color = MUTED;
Chart.defaults.font.family = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif";
Chart.defaults.font.size = 12;

export const fmt = {
  int: (n) => (n == null ? '–' : Math.round(Number(n)).toLocaleString()),
  num: (n, d = 1) => (n == null ? '–' : Number(n).toLocaleString(undefined, { maximumFractionDigits: d })),
  pct: (n, d = 1) => (n == null ? '–' : `${(Number(n) * 100).toFixed(d)}%`),
  dur: (sec) => {
    const s = Math.round(Number(sec) || 0);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  },
  mb: (n) => (n == null || n < 0 ? '–' : n >= 1024 ? `${(n / 1024).toFixed(1)} GB` : `${Math.round(n)} MB`),
};

/** Bucket label: "14:00" for hourly series, "Nov 17" for daily ones. */
export function bucketLabel(t, hourly) {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return t;
  return hourly
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * Line or bar chart over one shared x axis and ONE y axis.
 * series: [{ label, data: number[] }]; colors follow the series order.
 */
export function TimeChart({ labels, series, type = 'line', stacked = false, height = 220, yFormat, area = false }) {
  const canvas = useRef(null);
  const chart = useRef(null);

  useEffect(() => {
    if (!canvas.current) return undefined;
    const datasets = series.map((s, i) => {
      const color = s.color || SERIES[i % SERIES.length];
      return type === 'bar'
        ? {
            label: s.label, data: s.data, backgroundColor: color, borderColor: SURFACE, borderWidth: stacked ? { top: 2 } : 0,
            borderRadius: 4, borderSkipped: 'start', maxBarThickness: 28, categoryPercentage: 0.8, barPercentage: 0.9,
          }
        : {
            label: s.label, data: s.data, borderColor: color, backgroundColor: `${color}22`, borderWidth: 2,
            pointRadius: 0, pointHoverRadius: 4, pointHoverBorderColor: SURFACE, pointHoverBorderWidth: 2,
            pointHoverBackgroundColor: color, tension: 0.25, fill: area && i === 0 ? 'origin' : false,
          };
    });
    chart.current = new Chart(canvas.current, {
      type,
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: series.length > 1,
            align: 'start',
            labels: { color: INK, boxWidth: 10, boxHeight: 10, useBorderRadius: true, borderRadius: 2 },
          },
          tooltip: {
            backgroundColor: '#352131', borderColor: '#43293d', borderWidth: 1, titleColor: '#f5ecef',
            bodyColor: INK, padding: 10, boxPadding: 4, usePointStyle: true,
            callbacks: yFormat ? { label: (c) => ` ${c.dataset.label}: ${yFormat(c.parsed.y)}` } : undefined,
          },
        },
        scales: {
          x: {
            stacked, grid: { display: false }, border: { color: GRID },
            ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
          },
          y: {
            stacked, beginAtZero: true, grid: { color: GRID }, border: { display: false },
            ticks: { maxTicksLimit: 5, callback: yFormat ? (v) => yFormat(v) : undefined, precision: yFormat ? undefined : 0 },
          },
        },
      },
    });
    return () => chart.current?.destroy();
  }, [labels, series, type, stacked, yFormat, area]);

  const total = series[0]?.data?.length || 0;
  return (
    <div className="an-chart" style={{ height }}>
      <canvas ref={canvas} role="img" aria-label={`${series.map((s) => s.label).join(', ')} over ${total} periods`} />
    </div>
  );
}

/** Ranked horizontal bars in HTML: easier to read than a pie and fully labelled. */
export function BarList({ rows, valueKey = 'visitors', labelKey = 'key', format = fmt.int, empty = 'No data yet', color = SERIES[1] }) {
  if (!rows?.length) return <p className="an-empty">{empty}</p>;
  const max = Math.max(...rows.map((r) => Number(r[valueKey]) || 0), 1);
  return (
    <ul className="an-barlist">
      {rows.map((r, i) => {
        const v = Number(r[valueKey]) || 0;
        return (
          <li key={`${r[labelKey]}-${i}`} title={`${r[labelKey]}: ${format(v)}`}>
            <span className="an-barlist-fill" style={{ width: `${(v / max) * 100}%`, background: `${color}40` }} />
            <span className="an-barlist-label">{String(r[labelKey])}</span>
            <span className="an-barlist-value">{format(v)}</span>
          </li>
        );
      })}
    </ul>
  );
}

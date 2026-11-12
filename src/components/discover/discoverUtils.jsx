import React from 'react';

const AVATAR_COLORS = ['#7c3aed', '#0e7490', '#be185d', '#047857', '#b45309', '#4f46e5', '#be123c'];

export function initialsOf(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Stable colour per person so the same friend looks the same everywhere. */
export function avatarColor(seed = '') {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function firstName(name = '') {
  return String(name).trim().split(/\s+/)[0] || name;
}

/** Wraps every case-insensitive occurrence of `term` in <mark>. */
export function highlight(text = '', term = '') {
  const t = term.trim().replace(/^@+/, '');
  if (!t || !text) return text;
  const lower = text.toLowerCase();
  const needle = t.toLowerCase();
  const out = [];
  let from = 0;
  let idx = lower.indexOf(needle, from);
  while (idx !== -1) {
    if (idx > from) out.push(text.slice(from, idx));
    out.push(<mark key={idx}>{text.slice(idx, idx + needle.length)}</mark>);
    from = idx + needle.length;
    idx = lower.indexOf(needle, from);
  }
  if (from < text.length) out.push(text.slice(from));
  return out;
}

/** "6m 40s", "42 min", "45s" */
export function formatDuration(seconds, { compact = false } = {}) {
  if (seconds === null || seconds === undefined) return null;
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  if (compact || rem === 0 || m >= 10) return `${m} min`;
  return `${m}m ${rem}s`;
}

export function timeAgo(value) {
  if (!value) return null;
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function clockTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Today / Yesterday / Earlier this week / Earlier */
export function dayGroupOf(value, now = new Date()) {
  const day = startOfDay(new Date(value));
  const today = startOfDay(now);
  const dayMs = 86400000;
  if (day >= today) return 'Today';
  if (day >= today - dayMs) return 'Yesterday';
  if (day >= today - 6 * dayMs) return 'Earlier this week';
  return 'Earlier';
}

/** "3:42 PM" today/yesterday, "Mon, 8:30 PM" this week, "12 Oct, 8:30 PM" otherwise. */
export function matchTimeLabel(value, now = new Date()) {
  const group = dayGroupOf(value, now);
  const d = new Date(value);
  if (group === 'Today' || group === 'Yesterday') return clockTime(d);
  if (group === 'Earlier this week') return `${d.toLocaleDateString([], { weekday: 'short' })}, ${clockTime(d)}`;
  return `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${clockTime(d)}`;
}

export function matchedLabel(value, now = new Date()) {
  const group = dayGroupOf(value, now);
  if (group === 'Today' || group === 'Yesterday') return `${group}, ${clockTime(value)}`;
  return matchTimeLabel(value, now);
}

export const OUTCOMES = {
  BECAME_FRIENDS: { label: 'Became friends', tone: 'green' },
  REQUEST_SENT: { label: 'Request sent', tone: 'amber' },
  REQUEST_RECEIVED: { label: 'Wants to be friends', tone: 'violet' },
  THEY_SKIPPED: { label: 'They skipped', tone: '' },
  CHAT_ENDED: { label: 'Chat ended', tone: '' },
  IN_PROGRESS: { label: 'Chatting now', tone: 'violet' },
  REPORTED: { label: 'Reported', tone: 'rose' }
};

export function presenceLabel(friend) {
  if (friend?.isOnline) return 'Online';
  const ago = timeAgo(friend?.lastOnline);
  return ago ? `Active ${ago}` : 'Offline';
}

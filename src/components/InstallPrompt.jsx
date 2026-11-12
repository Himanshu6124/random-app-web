import React, { useEffect, useState } from 'react';
import { X, Share, PlusSquare, MoreVertical, Download, Zap, Bell, Maximize } from 'lucide-react';
import { haptic } from '../mobile/nativeShell';

const DISMISS_KEY = 'rm-install-dismissed-at';
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000; // ask again after 3 days
const SHOW_DELAY_MS = 2500;

// Chrome may fire this before React mounts, so capture it at module load.
let deferredPrompt = null;
const listeners = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    listeners.forEach((fn) => fn());
  });
}

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const isPhone = () => window.matchMedia?.('(max-width: 768px)').matches;

function readDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return at && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* storage blocked — the sheet just shows again next visit */
  }
}

/**
 * "Add to Home Screen" bottom sheet for phones.
 * - Android / Chrome: one-tap install through the native prompt.
 * - iOS Safari (no install API): Share → Add to Home Screen steps.
 * - Other browsers: browser-menu instructions.
 * Hidden once installed (standalone) and snoozed for a few days when dismissed.
 */
export function InstallPrompt() {
  const [open, setOpen] = useState(false);
  const [canPrompt, setCanPrompt] = useState(() => !!deferredPrompt);
  const ios = typeof window !== 'undefined' && isIOS();

  useEffect(() => {
    const update = () => setCanPrompt(!!deferredPrompt);
    listeners.add(update);
    return () => listeners.delete(update);
  }, []);

  useEffect(() => {
    if (isStandalone() || !isPhone() || readDismissed()) return undefined;
    const t = setTimeout(() => setOpen(true), SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  // Anywhere in the app can reopen it: window.dispatchEvent(new Event('rm:show-install'))
  useEffect(() => {
    const show = () => { if (!isStandalone()) setOpen(true); };
    window.addEventListener('rm:show-install', show);
    return () => window.removeEventListener('rm:show-install', show);
  }, []);

  const close = () => {
    writeDismissed();
    setOpen(false);
  };

  const install = async () => {
    haptic();
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } finally {
      deferredPrompt = null;
      setCanPrompt(false);
      close();
    }
  };

  if (!open || isStandalone()) return null;

  return (
    <div
      className="m-sheet-backdrop install-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="glass-panel m-sheet install-sheet" role="dialog" aria-modal="true" aria-labelledby="install-title">
        <button type="button" className="install-close" onClick={close} aria-label="Not now">
          <X size={18} />
        </button>

        <div className="install-head">
          <img src="/icon-192.png" alt="" className="install-icon" />
          <div>
            <h2 id="install-title">Add RandoMeet to Home Screen</h2>
            <p>Get the full-screen app experience</p>
          </div>
        </div>

        <ul className="install-perks">
          <li><Maximize size={16} /> Full screen, no browser bars</li>
          <li><Zap size={16} /> Opens instantly from your home screen</li>
          <li><Bell size={16} /> Feels just like a native app</li>
        </ul>

        {canPrompt ? (
          <div className="install-actions">
            <button type="button" className="btn-primary install-cta" onClick={install}>
              <Download size={18} /> Install App
            </button>
            <button type="button" className="install-later" onClick={close}>Not now</button>
          </div>
        ) : (
          <>
            <ol className="install-steps">
              {ios ? (
                <>
                  <li>
                    <span className="install-step-num">1</span>
                    Tap <span className="install-chip"><Share size={15} /> Share</span> in Safari&apos;s toolbar
                  </li>
                  <li>
                    <span className="install-step-num">2</span>
                    Choose <span className="install-chip"><PlusSquare size={15} /> Add to Home Screen</span>
                  </li>
                  <li>
                    <span className="install-step-num">3</span>
                    Tap <strong>Add</strong> in the top-right corner
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <span className="install-step-num">1</span>
                    Open the browser menu <span className="install-chip"><MoreVertical size={15} /></span>
                  </li>
                  <li>
                    <span className="install-step-num">2</span>
                    Tap <span className="install-chip"><PlusSquare size={15} /> Add to Home screen</span>
                  </li>
                  <li>
                    <span className="install-step-num">3</span>
                    Confirm with <strong>Add</strong> or <strong>Install</strong>
                  </li>
                </>
              )}
            </ol>
            <div className="install-actions">
              <button type="button" className="btn-secondary install-cta" onClick={close}>Got it</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

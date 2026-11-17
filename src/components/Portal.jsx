import { createPortal } from 'react-dom';

/**
 * Renders overlays (sheets, dialogs, cards) straight into <body>. Inside the app shell they
 * inherit the screen's stacking context and transform, so on phones a "fixed" sheet ended up
 * positioned against the screen and slid underneath the bottom tab bar.
 */
export function Portal({ children }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

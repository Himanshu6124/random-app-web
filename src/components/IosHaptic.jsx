import React from 'react';
import { isIOS, markIosTapHaptic } from '../mobile/nativeShell';

/**
 * Drop inside a `type="button"` button to get a haptic tick on iOS.
 *
 * iOS 26.5+ only plays the switch haptic when the user's own tap toggles a
 * native `<input switch>`, so this lays an invisible switch over its parent:
 * the tap lands on the switch's label, the switch toggles (tick), and the click
 * still bubbles to the button's onClick. The parent gets `position: relative`
 * (see .ios-haptic in mobile.css) unless it is already positioned.
 *
 * Not for submit buttons: the label takes over the click's default action, so
 * the form would not submit.
 */
export function IosHaptic() {
  if (!isIOS) return null;
  return (
    <label className="ios-haptic" aria-hidden="true" onClick={markIosTapHaptic}>
      {/* The label forwards a second click to the input; keep it from re-running the button's onClick. */}
      <input type="checkbox" switch="" tabIndex={-1} onClick={(e) => e.stopPropagation()} />
    </label>
  );
}

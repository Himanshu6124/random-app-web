import React from 'react';
import { Heart } from 'lucide-react';

/** Small sign-off shown at the bottom of the landing and match screens. */
export function CraftedCredit({ className = '' }) {
  return (
    <p className={`crafted-credit ${className}`.trim()}>
      Crafted with
      <Heart className="crafted-credit__heart" size={13} strokeWidth={0} fill="currentColor" aria-label="love" role="img" />
      in Bangalore
    </p>
  );
}

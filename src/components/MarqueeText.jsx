import React, { useLayoutEffect, useRef, useState } from 'react';

/**
 * One line of text that never wraps or pushes its neighbours. If it fits, it renders as-is;
 * if it is too long for its box, it slowly scrolls back and forth so the whole thing can be read.
 * With reduced motion it is truncated with an ellipsis instead (see .marquee in shell.css).
 */
export function MarqueeText({ as: Tag = 'span', className = '', style, children, title }) {
  const boxRef = useRef(null);
  const textRef = useRef(null);
  const [overflow, setOverflow] = useState(0);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text) return undefined;
    const measure = () => {
      const extra = Math.ceil(text.scrollWidth - box.clientWidth);
      setOverflow(extra > 2 ? extra : 0);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    ro.observe(text);
    return () => ro.disconnect();
  }, [children]);

  // ~40px per second, with pauses at each end built into the keyframes.
  const duration = Math.max(4, overflow / 40 + 3);

  return (
    <Tag
      ref={boxRef}
      className={`marquee${overflow ? ' marquee--on' : ''} ${className}`.trim()}
      style={style}
      title={title ?? (typeof children === 'string' ? children : undefined)}
    >
      <span
        ref={textRef}
        className="marquee__text"
        style={overflow ? { '--marquee-shift': `-${overflow}px`, '--marquee-duration': `${duration}s` } : undefined}
      >
        {children}
      </span>
    </Tag>
  );
}

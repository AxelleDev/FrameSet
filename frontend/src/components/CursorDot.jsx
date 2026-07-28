// Decorative cursor follower: a small lavender dot trailing the pointer with
// a short ease. Kept deliberately unobtrusive — the native cursor is never
// hidden or replaced, the dot ignores pointer events entirely, and it stays
// off for touch/coarse pointers and for users who prefer reduced motion.
// Position updates run through requestAnimationFrame + a transform on a ref,
// so following the mouse never re-renders React.
import React, { useEffect, useRef } from 'react';

// How fast the dot closes the gap to the pointer each frame (0-1): low enough
// to read as a trail, high enough to never feel laggy.
const EASE = 0.18;

export default function CursorDot() {
  const dotRef = useRef(null);

  useEffect(() => {
    const dot = dotRef.current;
    if (!dot) return undefined;
    // Coarse/no pointer (touch) or reduced motion: leave the dot hidden and
    // attach nothing at all.
    if (
      !window.matchMedia('(pointer: fine)').matches ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return undefined;
    }

    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let rafId = null;

    const tick = () => {
      x += (targetX - x) * EASE;
      y += (targetY - y) * EASE;
      dot.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      rafId = requestAnimationFrame(tick);
    };

    const handleMouseMove = (event) => {
      targetX = event.clientX;
      targetY = event.clientY;
      // First movement: appear where the pointer already is (no fly-in from a
      // corner), then start the follow loop lazily so an untouched mouse
      // (keyboard users) costs zero frames.
      if (rafId === null) {
        x = targetX;
        y = targetY;
        dot.style.opacity = '1';
        rafId = requestAnimationFrame(tick);
      }
    };

    // Hide when the pointer leaves the window (e.g. onto another monitor), and
    // pop back on the next movement inside it.
    const handleMouseLeave = () => {
      dot.style.opacity = '0';
    };
    const handleMouseEnter = () => {
      if (rafId !== null) dot.style.opacity = '1';
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', handleMouseLeave);
    document.documentElement.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
      document.documentElement.removeEventListener('mouseenter', handleMouseEnter);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={dotRef}
      aria-hidden="true"
      data-testid="cursor-dot"
      className="pointer-events-none fixed top-0 left-0 z-cursor h-2 w-2 rounded-full bg-blue/70 opacity-0 transition-opacity duration-300"
    />
  );
}

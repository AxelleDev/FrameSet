// Decorative cursor follower: a small lavender dot trailing the pointer with
// a short ease. It lives a little — stretching into an oval along its
// direction of travel when the mouse moves fast, and squishing down while a
// button is held — but stays unobtrusive: the native cursor is never hidden
// or replaced, the dot ignores pointer events entirely, and it stays off for
// touch/coarse pointers and for users who prefer reduced motion. All motion
// runs through requestAnimationFrame + a transform on a ref, so following the
// mouse never re-renders React.
import React, { useEffect, useRef } from 'react';

// How fast the dot closes the gap to the pointer each frame (0-1): low enough
// to read as a trail, high enough to never feel laggy.
const EASE = 0.18;
// Velocity → stretch conversion: px/frame divided by this feeds the oval
// deformation, capped so a fast flick reads as a streak, not a line.
const STRETCH_DIVISOR = 60;
const MAX_STRETCH = 0.85;
// How much the dot squishes while the mouse button is held.
const PRESS_SCALE = 0.55;

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
    // Deformation state, all eased so nothing ever snaps: stretch follows the
    // travel speed, angle follows the travel direction, press follows the
    // mouse button.
    let stretch = 0;
    let angle = 0;
    let press = 1;
    let pressTarget = 1;
    let rafId = null;

    const tick = () => {
      const previousX = x;
      const previousY = y;
      x += (targetX - x) * EASE;
      y += (targetY - y) * EASE;

      const dx = x - previousX;
      const dy = y - previousY;
      const speed = Math.hypot(dx, dy);
      const targetStretch = Math.min(speed / STRETCH_DIVISOR, MAX_STRETCH);
      stretch += (targetStretch - stretch) * 0.2;
      // Only steer while actually moving: near standstill the oval is a circle
      // again, so a stale angle can't make it visibly flip around.
      if (speed > 0.5) {
        angle = Math.atan2(dy, dx);
      }
      press += (pressTarget - press) * 0.3;

      // Stretch along the travel axis, thin down across it (roughly area-
      // preserving), squish uniformly while pressed.
      const scaleAlong = (1 + stretch) * press;
      const scaleAcross = (1 / (1 + stretch)) * press;
      dot.style.transform =
        `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) ` +
        `rotate(${angle}rad) scale(${scaleAlong}, ${scaleAcross})`;
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

    const handleMouseDown = () => {
      pressTarget = PRESS_SCALE;
    };
    const handleMouseUp = () => {
      pressTarget = 1;
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
    window.addEventListener('mousedown', handleMouseDown, { passive: true });
    window.addEventListener('mouseup', handleMouseUp, { passive: true });
    document.documentElement.addEventListener('mouseleave', handleMouseLeave);
    document.documentElement.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
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

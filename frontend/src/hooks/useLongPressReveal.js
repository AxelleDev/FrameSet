// Long-press reveal for touch screens: the counterpart of desktop's hover.
// Card actions that appear on `group-hover` with a mouse appear on touch only
// after a real press-and-hold — a plain tap or a scroll-graze must never flash
// them (the old CSS-only `:active` approach fired on first contact, which is
// exactly that bug).
//
// One instance manages a whole page of cards: call `getRevealProps(id)` on
// each card's `group` container. Only one card is revealed at a time; tapping
// anywhere outside collapses it. A successful hold swallows the click that
// fires on finger-lift, so holding a clickable card never also navigates.
// Buttons subscribe via the `group-data-[revealed]:` Tailwind variant.
import { useCallback, useEffect, useRef, useState } from 'react';

// Hold duration before the actions reveal. Matches the platform long-press
// convention (context menus, text selection ≈ 500-600ms): long enough that
// taps and scroll-grazes never trigger it, short enough not to fight the
// OS's own long-press gestures, which start around the same time.
export const LONG_PRESS_MS = 600;
// Finger drift tolerance: beyond this the gesture is a scroll, not a hold.
const MOVE_TOLERANCE_PX = 10;

export default function useLongPressReveal() {
  const [revealedId, setRevealedId] = useState(null);
  // The in-flight gesture; null between touches. `fired` flips when the hold
  // completes, so the touchend can flag the follow-up click for suppression.
  const gestureRef = useRef(null);
  const suppressNextClickRef = useRef(false);

  // Collapse on any touch that lands outside the revealed card.
  useEffect(() => {
    if (revealedId === null) return undefined;
    const handleOutsideTouch = (event) => {
      if (!event.target.closest?.('[data-revealed]')) {
        setRevealedId(null);
      }
    };
    document.addEventListener('touchstart', handleOutsideTouch, { capture: true, passive: true });
    return () => {
      document.removeEventListener('touchstart', handleOutsideTouch, { capture: true });
    };
  }, [revealedId]);

  const cancelGesture = useCallback(() => {
    if (gestureRef.current) {
      clearTimeout(gestureRef.current.timer);
      gestureRef.current = null;
    }
  }, []);

  const getRevealProps = useCallback(
    (id) => ({
      // Styling hook (see index.css): keeps the OS from starting text
      // selection / callouts mid-hold on touch screens.
      'data-longpress': '',
      'data-revealed': revealedId === id ? 'true' : undefined,

      onTouchStart: (event) => {
        if (event.touches.length !== 1) {
          cancelGesture();
          return;
        }
        const { clientX, clientY } = event.touches[0];
        cancelGesture();
        gestureRef.current = {
          startX: clientX,
          startY: clientY,
          fired: false,
          timer: setTimeout(() => {
            if (gestureRef.current) gestureRef.current.fired = true;
            setRevealedId(id);
            // Tiny haptic tick where supported, so the reveal is felt as well
            // as seen. try/catch: some browsers throw on vibrate without a
            // user gesture context.
            try {
              navigator.vibrate?.(10);
            } catch {
              /* purely decorative */
            }
          }, LONG_PRESS_MS),
        };
      },

      onTouchMove: (event) => {
        const gesture = gestureRef.current;
        if (!gesture || gesture.fired) return;
        const { clientX, clientY } = event.touches[0];
        if (
          Math.abs(clientX - gesture.startX) > MOVE_TOLERANCE_PX ||
          Math.abs(clientY - gesture.startY) > MOVE_TOLERANCE_PX
        ) {
          cancelGesture();
        }
      },

      onTouchEnd: () => {
        if (gestureRef.current?.fired) {
          suppressNextClickRef.current = true;
        }
        cancelGesture();
      },

      onTouchCancel: cancelGesture,

      // Capture phase, so the click born from a completed hold dies before it
      // reaches the card's own onClick (navigation, copy…) or a button's.
      onClickCapture: (event) => {
        if (suppressNextClickRef.current) {
          suppressNextClickRef.current = false;
          event.preventDefault();
          event.stopPropagation();
        }
      },

      // Android fires a context menu around the same hold duration; ours wins.
      onContextMenu: (event) => {
        if (gestureRef.current || revealedId === id) {
          event.preventDefault();
        }
      },
    }),
    [revealedId, cancelGesture],
  );

  return { getRevealProps };
}

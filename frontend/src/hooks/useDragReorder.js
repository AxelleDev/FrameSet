// Reusable drag-and-drop reorder behavior (FLIP animation, keyboard move,
// optimistic persistence with rollback). Extracted from ProjectPalette, which
// was the first place this pattern shipped; ProjectNorms and the dashboard's
// pinned-projects section reuse it so all three reorder the same way.
//
// `items` is the source of truth from outside (e.g. activeProject.palette);
// the hook mirrors it into local `items`/`previewItems` state so it can show
// a live preview during a drag before anything is persisted.
//
// `onPersist(nextItems)` is called once a reorder should be saved. Return:
// - an array to adopt as the new canonical items (e.g. the server's palette), or
// - `true` to keep the optimistic `nextItems` as-is (e.g. reorder endpoints
//   that only return `{ success: true }`), or
// - a falsy value to roll back to the previous order.
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';

export default function useDragReorder({
  items: sourceItems,
  getId = (item) => item.id,
  onPersist,
}) {
  const [items, setItems] = useState(sourceItems || []);
  const [previewItems, setPreviewItems] = useState(sourceItems || []);

  const [draggedIndex, setDraggedIndex] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Refs for the FLIP animation. itemRefs: id -> DOM node (to measure).
  // prevPositions: id -> rect captured before a reorder (the "First").
  // skipFlip: suppress the animation next layout pass (e.g. on cancel).
  // didDrop: real drop vs. cancelled drag in onDragEnd.
  // flipPending: a reorder happened and the FLIP should run next.
  const itemRefs = useRef({});
  const prevPositions = useRef({});
  const skipFlip = useRef(false);
  const didDrop = useRef(false);
  const flipPending = useRef(false);
  const dropPersistTimer = useRef(null);

  useEffect(() => () => clearTimeout(dropPersistTimer.current), []);

  // Mirror the external source whenever it loads/changes.
  useEffect(() => {
    if (Array.isArray(sourceItems)) {
      setItems(sourceItems);
      setPreviewItems(sourceItems);
    }
  }, [sourceItems]);

  // FLIP animation (First-Last-Invert-Play). After previewItems re-renders
  // items into their new (Last) spots, this runs before paint: measure each
  // node, compute the delta from its pre-reorder (First) rect in prevPositions,
  // translate it back (Invert), then clear the transform with a transition so it
  // slides to the new spot (Play).
  useLayoutEffect(() => {
    if (skipFlip.current) {
      skipFlip.current = false;
      Object.values(itemRefs.current).forEach((el) => {
        if (el) {
          el.style.transition = '';
          el.style.transform = '';
        }
      });
      return;
    }
    if (draggedId === null) return;
    if (!flipPending.current) return;
    flipPending.current = false;
    previewItems.forEach((item) => {
      // The dragged item is shown semi-transparent and is not FLIP-animated.
      if (getId(item) === draggedId) return;
      const el = itemRefs.current[getId(item)];
      const prev = prevPositions.current[getId(item)];
      if (!el || !prev) return;
      const curr = el.getBoundingClientRect();
      const dx = Math.round(prev.left - curr.left);
      const dy = Math.round(prev.top - curr.top);
      if (dx !== 0 || dy !== 0) {
        el.style.transition = 'none';
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        el.getBoundingClientRect(); // force reflow before animating
        el.style.transition = 'transform 280ms cubic-bezier(0.2, 0, 0, 1)';
        el.style.transform = '';
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewItems, draggedId]);

  // Persist a reorder, adopting the server's canonical result (or keeping the
  // optimistic order on a bare success). Rolls back on failure.
  const commitReorder = useCallback(
    async (nextItems, previousItems) => {
      const result = await onPersist(nextItems);
      if (!result) {
        setItems(previousItems);
        setPreviewItems(previousItems);
        return null;
      }
      const adopted = Array.isArray(result) ? result : nextItems;
      setItems(adopted);
      setPreviewItems(adopted);
      return adopted;
    },
    [onPersist],
  );

  // Move the item at `idx` to `target`, persist, and keep focus on it. Used by
  // the on-tile reorder buttons, so reordering also works by a single click
  // (and by keyboard, since the buttons are focusable), not only by drag.
  const moveItem = async (idx, target) => {
    if (target < 0 || target >= items.length) return;
    const previous = items;
    const next = [...items];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    setItems(next);
    setPreviewItems(next);
    requestAnimationFrame(() => {
      const el = itemRefs.current[getId(moved)];
      if (el) el.focus();
    });
    await commitReorder(next, previous);
  };

  // Replace the whole item list (not just a reorder) and persist it, e.g. an
  // add/edit/delete that also needs the new array saved. Same optimistic
  // update + rollback-on-failure contract as moveItem/drag-and-drop.
  const replaceItems = async (nextItems) => {
    const previous = items;
    setItems(nextItems);
    setPreviewItems(nextItems);
    return commitReorder(nextItems, previous);
  };

  const registerItemRef = (id) => (el) => {
    itemRefs.current[id] = el;
  };

  // Drag handlers for a single item, keyed by its current index in previewItems.
  const getDragHandlers = (item, idx) => ({
    draggable: true,
    onDragStart: (e) => {
      didDrop.current = false;
      flipPending.current = false;
      prevPositions.current = {};
      setDraggedIndex(idx);
      setDraggedId(getId(item));
      setDragOverIndex(idx);
      e.dataTransfer.effectAllowed = 'move';
    },
    onDragOver: (e) => {
      e.preventDefault();
      if (draggedId !== null && getId(item) !== draggedId) {
        if (idx === dragOverIndex) return;
        const snapshots = {};
        Object.keys(itemRefs.current).forEach((key) => {
          const el = itemRefs.current[key];
          if (el) snapshots[key] = el.getBoundingClientRect();
        });
        prevPositions.current = snapshots;
        flipPending.current = true;
        setDragOverIndex(idx);
        const tempItems = [...items];
        const [moved] = tempItems.splice(draggedIndex, 1);
        tempItems.splice(idx, 0, moved);
        setPreviewItems(tempItems);
      }
    },
    onDrop: (e) => {
      e.preventDefault();
      didDrop.current = true;
      flipPending.current = false;
      if (draggedId !== null && draggedIndex !== dragOverIndex) {
        const previous = items;
        const nextItems = [...items];
        const [moved] = nextItems.splice(draggedIndex, 1);
        nextItems.splice(dragOverIndex, 0, moved);
        setItems(nextItems);
        clearTimeout(dropPersistTimer.current);
        dropPersistTimer.current = setTimeout(() => {
          commitReorder(nextItems, previous);
        }, 200);
      }
      setDraggedIndex(null);
      setDraggedId(null);
      setDragOverIndex(null);
    },
    onDragEnd: () => {
      if (didDrop.current) {
        didDrop.current = false;
        flipPending.current = false;
        setDraggedIndex(null);
        setDraggedId(null);
        setDragOverIndex(null);
        return;
      }
      skipFlip.current = true;
      flipPending.current = false;
      setDraggedIndex(null);
      setDraggedId(null);
      setDragOverIndex(null);
      setPreviewItems(items);
    },
  });

  return {
    items,
    previewItems,
    draggedId,
    isDragging: (id) => id === draggedId,
    registerItemRef,
    getDragHandlers,
    moveItem,
    replaceItems,
  };
}

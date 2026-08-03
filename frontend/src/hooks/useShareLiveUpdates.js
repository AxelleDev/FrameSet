import { useEffect, useRef, useState } from 'react';

// Mirrors the api service's base so the stream rides the same /api proxy.
const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

/**
 * Live updates for a shared page: subscribes to the share's SSE stream and
 * calls `onChanged` whenever the owner edits the project, so the caller can
 * silently refetch. Returns whether the stream is currently connected (the
 * "Live" badge). EventSource reconnects by itself after a drop; a reconnect
 * also triggers `onChanged` once, so edits made during the gap are never
 * missed. No-ops when the browser lacks EventSource or `enabled` is false.
 */
export default function useShareLiveUpdates(token, { enabled = true, onChanged } = {}) {
  const [isLive, setIsLive] = useState(false);
  // Ref'd so a new callback identity never tears the connection down.
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  useEffect(() => {
    if (!enabled || !token || typeof EventSource === 'undefined') return undefined;

    const source = new EventSource(`${API_BASE}/share/${token}/events`);
    let wasConnected = false;

    source.onopen = () => {
      // Catch up after a reconnect: anything could have changed while offline.
      if (wasConnected) onChangedRef.current?.();
      wasConnected = true;
      setIsLive(true);
    };
    // Auto-reconnect is built into EventSource; just reflect the state.
    source.onerror = () => setIsLive(false);
    source.addEventListener('changed', () => onChangedRef.current?.());
    // The server ends the stream when the project's viewer cap is reached:
    // stop reconnect-hammering it, the page simply isn't live.
    source.addEventListener('full', () => {
      source.close();
      setIsLive(false);
    });

    return () => {
      source.close();
      setIsLive(false);
    };
  }, [token, enabled]);

  return isLive;
}

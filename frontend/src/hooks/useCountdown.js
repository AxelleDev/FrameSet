import { useEffect, useState } from 'react';

// Ticks a seconds value down to 0, one second at a time. Resets whenever
// `seconds` itself changes (e.g. a fresh 429 with a new Retry-After). Uses a
// single interval per `seconds` value (not a re-armed setTimeout per tick) so
// the countdown keeps ticking on its own schedule regardless of render timing.
export default function useCountdown(seconds) {
  const [remaining, setRemaining] = useState(seconds ?? 0);

  useEffect(() => {
    setRemaining(seconds ?? 0);
  }, [seconds]);

  useEffect(() => {
    if (!seconds || seconds <= 0) return undefined;
    const interval = setInterval(() => {
      setRemaining((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [seconds]);

  return remaining;
}

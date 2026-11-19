import { useEffect, useState } from 'react';

/** Current time that re-renders every `intervalMs` (so "overdue" badges flip without a reload). */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, intervalMs);
    // Coming back to the app (unlock, switch back) catches up at once instead of on the next tick.
    const onShow = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('focus', tick);
    };
  }, [intervalMs]);
  return now;
}

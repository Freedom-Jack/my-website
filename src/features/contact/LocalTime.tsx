'use client';

import { useEffect, useState } from 'react';

/**
 * The hour where he is (", 9:41 pm there"), for a visitor elsewhere: formatted in the browser from the site's time
 * zone. Nothing on the server and without JavaScript: the sentence then reads without it. It is rewritten when the
 * minute changes, by one timer set to that moment, and only while the page is showing.
 */
export function LocalTime({ zone, text }: { zone: string; text: string }) {
  const [time, setTime] = useState<string | null>(null);
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: zone });
    let id = 0;
    const tick = () => {
      clearTimeout(id);
      if (document.hidden) return;
      setTime(
        fmt
          .format(new Date())
          .replace(/^0/, '')
          .replace(/\s?([ap])\.?m\.?$/i, ' $1m'),
      );
      id = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    };
    tick();
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearTimeout(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [zone]);
  if (!time) return null;
  return <>{text.replace('{time}', time)}</>;
}

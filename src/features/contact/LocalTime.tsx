'use client';

import { useEffect, useState } from 'react';

/**
 * The local time where he is (", 9:41 there"), for a visitor elsewhere: formatted in the browser from the site's time
 * zone, refreshed every 30 s. Rendered as nothing on the server and without JS, so the sentence reads as before.
 */
export function LocalTime({ zone, text }: { zone: string; text: string }) {
  const [time, setTime] = useState<string | null>(null);
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: zone });
    const tick = () =>
      setTime(
        fmt
          .format(new Date())
          .replace(/^0/, '')
          .replace(/\s?([ap])\.?m\.?$/i, ' $1m'),
      );
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [zone]);
  if (!time) return null;
  return <>{text.replace('{time}', time)}</>;
}

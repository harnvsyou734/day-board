'use client';

import { useEffect, useState } from 'react';

/**
 * navigator.onLine is optimistic -- it reports true for a connected wifi that
 * routes nowhere -- so a failed write also flips this to false. Being online
 * is assumed until something actually fails or the browser says otherwise.
 */
export function useOnline(): [boolean, (value: boolean) => void] {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  return [online, setOnline];
}

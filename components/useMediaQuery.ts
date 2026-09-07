'use client';

import { useEffect, useState } from 'react';

/**
 * Returns false on the server and on first paint, then corrects after mount.
 * Phone is the primary target, so the pre-mount answer is the phone layout --
 * the case that must never flicker.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const list = window.matchMedia(query);
    setMatches(list.matches);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

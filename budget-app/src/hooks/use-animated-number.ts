"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fait glisser un nombre vers sa nouvelle valeur (ex. après un ajout).
 * Instantané si l'utilisateur a demandé à réduire les animations.
 */
export function useAnimatedNumber(target: number, duration = 700): number {
  const [value, setValue] = useState(target);
  const shown = useRef(target);

  useEffect(() => {
    const from = shown.current;
    if (from === target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const length = reduce ? 0 : duration;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = length === 0 ? 1 : Math.min((now - start) / length, 1);
      const next = from + (target - from) * (1 - (1 - t) ** 3);
      shown.current = t === 1 ? target : next;
      setValue(shown.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

import { useEffect, useRef, DependencyList } from "react";

export function useDebouncedEffect(
  effect: () => void | (() => void),
  deps: DependencyList,
  delayMs: number,
  enabled: boolean = true
): void {
  const cleanupRef = useRef<void | (() => void)>(undefined);

  useEffect(() => {
    if (!enabled) return;

    const timer = setTimeout(() => {
      cleanupRef.current = effect();
    }, delayMs);

    return () => {
      clearTimeout(timer);
      if (typeof cleanupRef.current === "function") {
        cleanupRef.current();
        cleanupRef.current = undefined;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delayMs, enabled]);
}


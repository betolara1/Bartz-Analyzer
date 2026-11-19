export function preventSonnerOutsideDismiss(
  e: any,
  onFallback?: (e: any) => void
): void {
  const target = (e?.detail?.originalEvent?.target || e?.target) as HTMLElement | SVGElement | null;
  if (target?.closest?.("[data-sonner-toaster], [data-sonner-toast]")) {
    e?.preventDefault?.();
    return;
  }
  onFallback?.(e);
}


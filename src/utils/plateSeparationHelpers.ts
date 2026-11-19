export function isLotLancado(item: any): boolean {
  if (!item) return false;
  const status = String(item.status || "").toLowerCase().trim();
  return status.includes("lançado") || status.includes("lancado") || !!item.lancado_erp;
}

export function isLotConcluidoPendingLaunch(item: any): boolean {
  if (!item) return false;
  const status = String(item.status || "").toLowerCase().trim();
  return !isLotLancado(item) && status.includes("concluido");
}

export function isLotVisibleInModal(item: any): boolean {
  if (!item) return false;
  const status = String(item.status || "").toLowerCase().trim();
  return isLotLancado(item) || status.includes("concluido");
}


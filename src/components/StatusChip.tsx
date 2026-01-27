// src/components/StatusChip.tsx
export type Status = "OK" | "ERRO" | "FERRAGENS-ONLY";

export function StatusChip({ status }: { status?: Status }) {
  const s = status ?? "-";
  const cfg =
    s === "OK"
      ? { label: "OK", cls: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" }
      : s === "ERRO"
      ? { label: "ERRO", cls: "text-rose-400 border-rose-400/30 bg-rose-400/10" }
      : s === "FERRAGENS-ONLY"
      ? { label: "FERRAGENS-ONLY", cls: "text-amber-400 border-amber-400/30 bg-amber-400/10" }
      : { label: s, cls: "text-zinc-300 border-zinc-600/50 bg-zinc-700/30" };

  return (
    <span className={`inline-flex items-center rounded border px-2 py-[2px] text-[10px] ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

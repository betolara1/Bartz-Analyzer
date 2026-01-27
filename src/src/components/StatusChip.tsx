import React from "react";

type Status = "OK" | "ERRO" | "FERRAGENS-ONLY" | undefined;

export function StatusChip({ status }: { status: Status }) {
  if (!status) return <span className="text-xs opacity-60">-</span>;

  const styles: Record<string, string> = {
    "OK": "bg-emerald-600/15 text-emerald-400 border-emerald-600/30",
    "ERRO": "bg-rose-600/15 text-rose-400 border-rose-600/30",
    "FERRAGENS-ONLY": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium border rounded ${styles[status] || "border-zinc-700 text-zinc-300"}`}
    >
      {status}
    </span>
  );
}

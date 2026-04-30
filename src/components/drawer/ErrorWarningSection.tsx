import React from "react";
import { AlertTriangle, Info, CheckCircle } from "lucide-react";
import { BadgeErro } from "../BadgeErro";
import { AutoFixBadge } from "../AutoFixBadge";
import { Row } from "../../types";

interface ErrorWarningSectionProps {
  data: Row | null;
}

export function ErrorWarningSection({ data }: ErrorWarningSectionProps) {
  const errors = data?.errors || [];
  const warnings = data?.warnings || [];
  const autoFixes = data?.autoFixes || [];

  if (errors.length === 0 && warnings.length === 0 && autoFixes.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-3">
        <CheckCircle className="h-5 w-5 text-emerald-500" />
        <p className="text-sm text-emerald-500/80 font-medium tracking-tight">Nenhuma inconformidade ou aviso detectado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-muted/30 p-4 rounded-xl border border-border hover:border-primary/50 transition-colors">
      {/* ERROS */}
      {errors.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <AlertTriangle className="h-4 w-4 text-rose-500" />
            <h4 className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Inconformidades ({errors.length})</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {errors.map((e, i) => (
              <BadgeErro key={i} error={e} />
            ))}
          </div>
        </div>
      )}

      {/* AUTO FIXES */}
      {autoFixes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <h4 className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Correções Automáticas ({autoFixes.length})</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {autoFixes.map((f, i) => (
              <AutoFixBadge key={i} fix={f} />
            ))}
          </div>
        </div>
      )}

      {/* WARNINGS */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Info className="h-4 w-4 text-amber-500" />
            <h4 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Avisos ({warnings.length})</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {warnings.map((w, i) => (
              <div key={i} className="text-[11px] bg-amber-500/5 text-amber-500/70 border border-amber-500/10 px-2 py-1 rounded-md font-medium leading-tight italic">
                {w}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

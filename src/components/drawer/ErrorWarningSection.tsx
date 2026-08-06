import React from "react";
import { AlertTriangle, Info, CheckCircle, Wrench } from "lucide-react";
import { BadgeErro } from "../BadgeErro";
import { AutoFixBadge } from "../AutoFixBadge";
import { Badge } from "../ui/badge";
import { Row } from "../../types";

interface ErrorWarningSectionProps {
  data: Row | null;
  onMoveToOk?: () => void;
}

export function ErrorWarningSection({ data, onMoveToOk }: ErrorWarningSectionProps) {
  const errors = data?.errors || [];
  const warnings = data?.warnings || [];
  const autoFixes = data?.autoFixes || [];

  const normalizeFix = (f: string) => f === "Movido para pasta OK" ? "Movido manualmente para a pasta OK" : f;
  const manualFixesFromProp = (data?.manualFixes || []).map(normalizeFix);
  const manualFixesFromHistory = (data?.history || [])
    .filter(h => h.includes("[Manual]") || h.toLowerCase().includes("movido para pasta ok") || h.toLowerCase().includes("movido manualmente"))
    .map(h => normalizeFix(h.replace(/^\[\d{1,2}:\d{2}:\d{2}\]\s*/, '').replace(/^\[Manual\]\s*/i, '').trim()));
  const manualFixes = Array.from(new Set([...manualFixesFromProp, ...manualFixesFromHistory]));

  const isErpError = (e: string) => String(e).toLowerCase().includes("não encontrado no erp");
  const isMuxarabiError = (e: string) => String(e).toUpperCase().includes("PEÇA MUXARABI");

  const hasSemCodigoErp = data?.tags?.includes("sem código erp") || errors.some(isErpError);
  const hasMuxarabi = data?.tags?.includes("muxarabi") || errors.some(isMuxarabiError);
  const hasBypassableError = hasSemCodigoErp || hasMuxarabi;

  const otherErrors = errors.filter(e => !isErpError(e) && !isMuxarabiError(e));
  const hasOtherErrors = otherErrors.length > 0;

  if (errors.length === 0 && warnings.length === 0 && autoFixes.length === 0 && manualFixes.length === 0) {
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

          {hasBypassableError && (
            <div className="pt-2 border-t border-border/40 mt-3">
              <button
                onClick={onMoveToOk}
                disabled={hasOtherErrors}
                className={`
                  w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-bold text-xs uppercase tracking-wider transition-all duration-200
                  ${hasOtherErrors
                    ? "bg-zinc-800/50 text-zinc-500 border border-zinc-700/30 cursor-not-allowed opacity-60"
                    : "bg-emerald-500 text-black hover:bg-emerald-600 shadow-lg shadow-emerald-500/10 active:scale-[0.98]"
                  }
                `}
              >
                <CheckCircle className="h-4 w-4" />
                Enviar para OK
              </button>
              {hasOtherErrors && (
                <p className="text-[10px] text-rose-400/80 font-bold tracking-wide uppercase mt-2 text-center leading-normal">
                  * Trate as outras inconformidades primeiro para liberar o envio.
                </p>
              )}
            </div>
          )}
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

      {/* CORREÇÕES MANUAIS */}
      {manualFixes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Wrench className="h-4 w-4 text-blue-400" />
            <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Correções Manuais ({manualFixes.length})</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {manualFixes.map((m, i) => (
              <Badge key={i} variant="outline" className="text-blue-400 border-blue-500/30 bg-blue-500/10 text-xs">
                {m}
              </Badge>
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
